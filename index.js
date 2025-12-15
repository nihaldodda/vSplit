const vision = require('@google-cloud/vision');
const client = new vision.ImageAnnotatorClient({
  keyFilename: './vsplit-473108-1e4195e3b87e.json',
});

async function detectText(imagePath) {
  const [result] = await client.textDetection(imagePath);
  const detections = result.textAnnotations;
  return detections.length > 0 ? detections[0].description : '';
}

// Usage:
detectText('./sample bill.png').then(console.log);
