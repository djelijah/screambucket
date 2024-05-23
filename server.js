const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { configDotenv } = require('dotenv');

configDotenv

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static('public'));

// Configure AWS S3
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const s3 = new AWS.S3();
const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Utility function to read JSON file from S3
async function readJSONFileFromS3(key) {
  try {
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
    };
    const data = await s3.getObject(params).promise();
    return JSON.parse(data.Body.toString('utf-8'));
  } catch (error) {
    console.error('Error reading JSON file from S3:', error);
    return [];
  }
}

// Utility function to write JSON file to S3
async function writeJSONFileToS3(key, data) {
  try {
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: JSON.stringify(data, null, 2),
      ContentType: 'application/json',
    };
    await s3.putObject(params).promise();
  } catch (error) {
    console.error('Error writing JSON file to S3:', error);
  }
}

// Endpoint to save drawing data
app.post('/save-drawing', async (req, res) => {
  const newLine = req.body.lines;
  let drawingData = await readJSONFileFromS3('drawingData.json');

  drawingData = newLine; // replace the whole drawing data with the new data
  await writeJSONFileToS3('drawingData.json', drawingData);
  res.sendStatus(200);
});

// Endpoint to retrieve drawing data
app.get('/get-drawing', async (req, res) => {
  const drawingData = await readJSONFileFromS3('drawingData.json');
  res.json(drawingData);
});

// Endpoint to save audio file
app.post('/upload-audio', upload.single('audio'), (req, res) => {
  const audioFile = req.file;
  const audioId = uuidv4();
  const s3Params = {
    Bucket: BUCKET_NAME,
    Key: `${audioId}.wav`,
    Body: audioFile.buffer,
    ContentType: audioFile.mimetype,
  };

  s3.upload(s3Params, async (err, data) => {
    if (err) {
      console.error('Error uploading audio to S3:', err);
      res.status(500).send('Error uploading audio');
    } else {
      const audioData = {
        id: audioId,
        url: data.Location,
      };

      let audioFiles = await readJSONFileFromS3('audioData.json');
      audioFiles.push(audioData);
      await writeJSONFileToS3('audioData.json', audioFiles);
      res.sendStatus(200);
    }
  });
});

// Endpoint to retrieve audio files
app.get('/get-audio', async (req, res) => {
  const audioFiles = await readJSONFileFromS3('audioData.json');
  res.json(audioFiles);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
