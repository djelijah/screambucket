const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
});

app.use(bodyParser.json());
app.use(express.static('public'));

// Middleware to log incoming requests
app.use((req, res, next) => {
    console.log(`Received ${req.method} request for ${req.url}`);
    next();
});

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const drawingDataKey = 'drawingData.json';
const audioDataKey = 'audioData.json';

async function fetchS3Data(key) {
    try {
        const params = {
            Bucket: process.env.AWS_S3_BUCKET_NAME,
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
            Bucket: process.env.AWS_S3_BUCKET_NAME,
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

// Endpoint to save drawing data
app.post('/save-drawing', async (req, res) => {
    try {
        const newLine = req.body.lines;
        let drawingData = await fetchS3Data(drawingDataKey);

        drawingData = newLine; // replace the whole drawing data with the new data
        await saveS3Data(drawingDataKey, drawingData);
        res.sendStatus(200);
    } catch (error) {
        console.error('Error saving drawing data:', error);
        res.status(500).send('Error saving drawing data');
    }
});

// Endpoint to retrieve drawing data
app.get('/get-drawing', async (req, res) => {
    try {
        const drawingData = await fetchS3Data(drawingDataKey);
        res.json(drawingData);
    } catch (error) {
        console.error('Error retrieving drawing data:', error);
        res.status(500).send('Error retrieving drawing data');
    }
});

// Endpoint to save audio file
app.post('/upload-audio', upload.single('audio'), async (req, res) => {
    try {
        const audioFile = req.file;
        const audioKey = `${uuidv4()}.wav`;

        const params = {
            Bucket: process.env.AWS_S3_BUCKET_NAME,
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
        const audioFilesWithUrls = audioFiles.map(file => ({
            ...file,
            url: s3.getSignedUrl('getObject', {
                Bucket: process.env.AWS_S3_BUCKET_NAME,
                Key: file.filename,
                Expires: 60 * 60, // URL expires in 1 hour
            }),
        }));
        res.json(audioFilesWithUrls);
    } catch (error) {
        console.error('Error retrieving audio files:', error);
        res.status(500).send('Error retrieving audio files');
    }
});

// Serve the uploaded audio files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
