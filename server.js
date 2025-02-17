const express = require('express');
const multer = require('multer');
const libreoffice = require('libreoffice-convert');
const ffmpeg = require('fluent-ffmpeg');
const sharp = require('sharp');
const cors = require('cors');
const util = require('util');
const fs = require('fs');

const app = express();
app.use(cors());

const upload = multer({ dest: 'uploads/' });
const convertAsync = util.promisify(libreoffice.convert);

app.post('/convert', upload.single('file'), async (req, res) => {
    try {
        const { file } = req;
        const { format } = req.body;
        const type = getFileType(file.originalname);

        let outputBuffer;
        switch(type) {
            case 'document':
                outputBuffer = await convertDocument(file, format);
                break;
            case 'image':
                outputBuffer = await convertImage(file, format);
                break;
            case 'video':
            case 'audio':
                outputBuffer = await convertMedia(file, format);
                break;
            default:
                throw new Error('Неподдерживаемый формат');
        }

        res.setHeader('Content-Type', `application/${format}`);
        res.setHeader('Content-Disposition', `attachment; filename="converted.${format}"`);
        res.send(outputBuffer);

    } catch (error) {
        console.error(error);
        res.status(500).send(error.message);
    } finally {
        // Очистка временных файлов
        if (req.file) fs.unlinkSync(req.file.path);
    }
});

app.listen(3000, () => {
    console.log('Сервер запущен на порту 3000');
});

// Функции определения типа файла
const getFileType = (filename) => {
    const ext = '.' + filename.split('.').pop().toLowerCase();
    const SUPPORTED_FORMATS = {
        'document': ['.doc', '.docx', '.pdf', '.txt', '.rtf', '.odt'],
        'image': ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'],
        'video': ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm'],
        'audio': ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.wma']
    };

    for (const [type, formats] of Object.entries(SUPPORTED_FORMATS)) {
        if (formats.includes(ext)) return type;
    }
    return null;
};

// Конвертация документов через LibreOffice
const convertDocument = async (file, format) => {
    const inputBuffer = fs.readFileSync(file.path);
    const outputBuffer = await convertAsync(inputBuffer, format, undefined);
    return outputBuffer;
};

// Конвертация изображений через Sharp
const convertImage = async (file, format) => {
    const inputBuffer = fs.readFileSync(file.path);
    let sharpInstance = sharp(inputBuffer);
    
    switch(format) {
        case 'jpg':
        case 'jpeg':
            return await sharpInstance.jpeg({ quality: 90 }).toBuffer();
        case 'png':
            return await sharpInstance.png().toBuffer();
        case 'webp':
            return await sharpInstance.webp({ quality: 90 }).toBuffer();
        case 'gif':
            return await sharpInstance.gif().toBuffer();
        default:
            throw new Error('Неподдерживаемый формат изображения');
    }
};

// Конвертация медиа через FFmpeg
const convertMedia = (file, format) => {
    return new Promise((resolve, reject) => {
        const outputPath = `${file.path}.${format}`;
        
        ffmpeg(file.path)
            .toFormat(format)
            .on('end', () => {
                const outputBuffer = fs.readFileSync(outputPath);
                fs.unlinkSync(outputPath);
                resolve(outputBuffer);
            })
            .on('error', (err) => reject(err))
            .save(outputPath);
    });
}; 