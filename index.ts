import express, { Request, Response } from "express";
import { chromium, Page } from "playwright";
import OpenAI from "openai";
import fs from "fs";
import sqlite3 from "sqlite3";
import dotenv from "dotenv";
dotenv.config({ path: ".env" });

const app = express();
app.use(express.json()); // Middleware to parse JSON requests

const db = new sqlite3.Database("./testResults.db");

// OpenAI setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
// Type Definitions
interface Step {
  step: string;
  status: "SUCCESS" | "FAILED";
  screenshot?: string;
  error?: string;
}

// Initialize database
db.run(`
  CREATE TABLE IF NOT EXISTS TestResults (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    testId TEXT,
    status TEXT,
    startTime TEXT,
    endTime TEXT,
    steps TEXT,
    aiAnalysis TEXT
  )
`);

// Trigger test
app.post("/api/test/start", async (req: Request, res: Response) => {
  const testId = `test-${Date.now()}`;
  const url: string = req.body.url;
  const steps: Step[] = [];
  const startTime = new Date().toISOString();
  let status: "SUCCESS" | "FAILED" = "FAILED";
  let aiAnalysis: any | null = null;

  const browser = await chromium.launch();
  const page: Page = await browser.newPage();

  try {
    // Step 1: Navigate to website
    await page.goto("https://video-converter.com");
    const step1Screenshot = `step1-${testId}.png`;
    await page.screenshot({ path: step1Screenshot });
    steps.push({
      step: "Navigate to converter",
      status: "SUCCESS",
      screenshot: step1Screenshot,
    });

    // Step 2: Input URL
    await page.fill("input#video-url", url);
    await page.click("button#convert");
    const step2Screenshot = `step2-${testId}.png`;
    await page.screenshot({ path: step2Screenshot });
    steps.push({
      step: "Input YouTube URL",
      status: "SUCCESS",
      screenshot: step2Screenshot,
    });

    // Step 3: Wait for conversion result
    await page.waitForSelector("div#download-link", { timeout: 30000 });
    const step3Screenshot = `step3-${testId}.png`;
    await page.screenshot({ path: step3Screenshot });
    steps.push({
      step: "Attempt conversion",
      status: "SUCCESS",
      screenshot: step3Screenshot,
    });

    status = "SUCCESS";
  } catch (error: any) {
    // Capture error and AI analysis
    steps.push({
      step: "Attempt conversion",
      status: "FAILED",
      error: error.message,
    });

    const prompt = `
      Analyze the following test failure:
      Error: ${error.message}
      Steps: ${JSON.stringify(steps)}

      Provide a human-readable explanation and recommendations in this format
      “aiAnalysis": {
        “explanation™: human-readable explanation,
        "recommendation": recommendations,
        "confidence": confidence level from 0.0 to 1.0
      }
    `;
    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      store: true,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });
    if (!aiResponse) {
      throw new Error("AI Response is null");
    }
    aiAnalysis = JSON.parse(
      aiResponse.choices[0].message.content
        .trim()
        .replace("```json", "")
        .replace("```", "")
    );
    console.log(aiAnalysis);
  } finally {
    await browser.close();
    const endTime = new Date().toISOString();
    db.run(
      `INSERT INTO TestResults (testId, status, startTime, endTime, steps, aiAnalysis)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        testId,
        status,
        startTime,
        endTime,
        JSON.stringify(steps),
        JSON.stringify(aiAnalysis?.aiAnalysis),
      ]
    );

    res.json({ testId, status });
  }
});

// Fetch test single result
app.get("/api/test/result/:testId", (req: Request, res: Response) => {
  const testId = req.params.testId;
  db.get(
    "SELECT * FROM TestResults WHERE testId = ?",
    [testId],
    (err, row: any) => {
      if (err || !row) {
        res.status(404).json({ error: "Test not found" });
      } else {
        res.json({
          testId: row.testId,
          status: row.status,
          startTime: row.startTime,
          endTime: row.endTime,
          steps: JSON.parse(row.steps),
          aiAnalysis: JSON.parse(row.aiAnalysis),
        });
      }
    }
  );
});

// Start server
app.listen(3000, () => console.log("Server running on port 3000"));
