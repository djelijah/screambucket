const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const aws = require('aws-sdk');

const app = express();
const PORT = process.env.PORT || 3000;

// Increase the limit for JSON requests (adjust the limit as needed)
app.use(bodyParser.json({ limit: '10mb' }));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `${uuidv4()}.wav`); // Save the file with a .wav extension
    }
});

const upload = multer({ storage: storage });

app.use(bodyParser.json());
app.use(express.static('public'));

// AWS S3 configuration
const s3 = new aws.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

// Utility function to fetch drawing data from Vercel
async function fetchDrawingData() {
    try {
        const response = await fetch('https://your-vercel-deployment-url/get-drawing');
        const drawingData = await response.json();
        return drawingData;
    } catch (error) {
        console.error('Error fetching drawing data:', error);
        return [];
    }
}

// Utility function to fetch audio data from Vercel
async function fetchAudioData() {
    try {
        const response = await fetch('https://your-vercel-deployment-url/get-audio');
        const audioData = await response.json();
        return audioData;
    } catch (error) {
        console.error('Error fetching audio data:', error);
        return [];
    }
}

// Endpoint to save drawing data (not needed if you're fetching from Vercel)
// Endpoint to retrieve drawing data (fetch from Vercel instead)
// Endpoint to save audio file (not needed if you're fetching from Vercel)
// Endpoint to retrieve audio files (fetch from Vercel instead)

// Serve the uploaded audio files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
