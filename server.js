const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { configDotenv } = require('dotenv');


const app = express();
const PORT = process.env.PORT || 3000;

const s3 = new AWS.S3({
    accessKeyId: 'YOUR_ACCESS_KEY_ID',
    secretAccessKey: 'YOUR_SECRET_ACCESS_KEY',
    region: 'YOUR_REGION',
    // Add other configuration options if necessary
});

app.use(bodyParser.json());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const audioDataKey = 'audioData.json'; // Key for storing metadata of audio files

async function fetchS3Data(key) {
    try {
        const params = {
            Bucket: 'YOUR_BUCKET_NAME',
            Key: key,
        };
        const data = await s3.getObject(params).promise();
        return JSON.parse(data.Body.toString('utf-8'));
    } catch (err) {
        console.error(`Error fetching data from S3 for key ${key}:`, err);
        return [];
    }
}

async function saveS3Data(key, data) {
    try {
        const params = {
            Bucket: 'YOUR_BUCKET_NAME',
            Key: key,
            Body: JSON.stringify(data, null, 2),
            ContentType: 'application/json',
        };
        await s3.putObject(params).promise();
        console.log(`Successfully saved data to S3 for key ${key}`);
    } catch (err) {
        console.error(`Error saving data to S3 for key ${key}:`, err);
    }
}

// Endpoint to save audio file
app.post('/upload-audio', upload.single('audio'), async (req, res) => {
    try {
        const audioFile = req.file;
        const audioKey = `${uuidv4()}.wav`; // Unique key for the audio file

        const params = {
            Bucket: 'YOUR_BUCKET_NAME',
            Key: audioKey,
            Body: audioFile.buffer,
            ContentType: audioFile.mimetype,
        };
        await s3.upload(params).promise();

        const audioData = {
            id: uuidv4(),
            filename: audioKey,
            originalname: audioFile.originalname,
            mimetype: audioFile.mimetype,
            size: audioFile.size,
        };

        let audioFiles = await fetchS3Data(audioDataKey);
        audioFiles.push(audioData);
        await saveS3Data(audioDataKey, audioFiles);
        res.sendStatus(200);
    } catch (error) {
        console.error('Error uploading audio:', error);
        res.status(500).send('Error uploading audio');
    }
});

// Endpoint to retrieve audio files
app.get('/get-audio', async (req, res) => {
    try {
        const audioFiles = await fetchS3Data(audioDataKey);
        res.json(audioFiles);
    } catch (error) {
        console.error('Error retrieving audio files:', error);
        res.status(500).send('Error retrieving audio files');
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
