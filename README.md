# AI Video Converter

To install the dependecies, run the following command:

```bash
npm install
```

To start the server, run the following command:

```bash
npm run dev
```

This will start the server on port 3000.

## Endpoints

### POST /api/test/start

Starts a new test with the provided YouTube URL.

#### Parameters

- url (string): The YouTube URL to convert.

#### Response

- id (string): The ID of the test.

### POST /api/test/result/:id

Fetches the result of a test with the provided ID.

#### Parameters

- id (string): The ID of the test.

#### Response

- testId (string): The ID of the test.
- status (string): The status of the test.
- startTime (string): The start time of the test.
- endTime (string): The end time of the test.
- steps (array): An array of steps in the test.
- aiAnalysis (object): The AI analysis of the test.
