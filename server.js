const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const AWS = require('aws-sdk');
const { configDotenv } = require('dotenv');

const app = express();
const PORT = process.env.PORT || 3000;

configDotenv

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

// Configure AWS SDK with your credentials
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

const s3 = new AWS.S3();

// Utility function to read and parse JSON file safely
function readJSONFileSync(filePath) {
    if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        if (fileContent) {
            return JSON.parse(fileContent);
        }
    }
    return [];
}

// Endpoint to save drawing data
app.post('/save-drawing', (req, res) => {
    const newLine = req.body.lines;
    let drawingData = readJSONFileSync('drawingData.json');

    drawingData = newLine; // replace the whole drawing data with the new data
    fs.writeFileSync('drawingData.json', JSON.stringify(drawingData, null, 2));
    res.sendStatus(200);
});

// Endpoint to retrieve drawing data
app.get('/get-drawing', (req, res) => {
    const drawingData = readJSONFileSync('drawingData.json');
    res.json(drawingData);
});

// Endpoint to save audio file
app.post('/upload-audio', upload.single('audio'), (req, res) => {
    const audioFile = req.file;
    const audioData = {
        id: uuidv4(),
        filename: audioFile.filename,
        originalname: audioFile.originalname,
        mimetype: audioFile.mimetype,
        size: audioFile.size,
    };

    let audioFiles = readJSONFileSync('audioData.json');
    audioFiles.push(audioData);
    fs.writeFileSync('audioData.json', JSON.stringify(audioFiles, null, 2));
    res.sendStatus(200);
});

// Endpoint to retrieve audio files
app.get('/get-audio', (req, res) => {
    // List objects in the S3 bucket and return their URLs
    s3.listObjectsV2({ Bucket: process.env.AWS_S3_BUCKET_NAME }, (err, data) => {
        if (err) {
            console.error('Error listing objects:', err);
            res.status(500).send('Error listing objects');
        } else {
            const audioFiles = data.Contents.map(obj => ({
                url: `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/${obj.Key}`,
                key: obj.Key
            }));
            res.json(audioFiles);
        }
    });
});

// Serve the uploaded audio files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
