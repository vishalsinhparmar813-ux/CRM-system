const AWS = require('aws-sdk');
const path = require('path');
const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET } = require('../constants');

const s3 = new AWS.S3({
  accessKeyId: AWS_ACCESS_KEY_ID,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
  region: AWS_REGION,
});

const BUCKET = AWS_S3_BUCKET;

/**
 * Upload a file buffer to S3
 * @param {Object} params
 * @param {Buffer} params.buffer - File buffer
 * @param {string} params.key - S3 key (path/filename)
 * @param {string} params.mimetype - File mimetype
 * @returns {Promise<string>} - S3 file URL
 */
async function uploadFileToS3({ buffer, key, mimetype }) {
  const uploadParams = {
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimetype,
    ACL: 'public-read', // or private if you want
  };
  // console.log(uploadParams);
  await s3.upload(uploadParams).promise();
  return `https://${BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`;
}

module.exports = { uploadFileToS3 }; 