require('dotenv').config();
const https = require('https');

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3';

async function testYouTubeSearch() {
  console.log('YouTube API Key:', YOUTUBE_API_KEY ? 'Present' : 'Missing');

  const query = 'scrambled eggs recipe';
  const searchUrl = `${YOUTUBE_API_BASE_URL}/search?part=snippet&q=${encodeURIComponent(query)}&maxResults=3&type=video&key=${YOUTUBE_API_KEY}`;

  console.log('Search URL:', searchUrl);

  try {
    const response = await new Promise((resolve, reject) => {
      https.get(searchUrl, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });

    console.log('Response Status:', response.status);
    console.log('Response Data:', JSON.stringify(response.data, null, 2));

    const data = response.data;

    if (data.items && data.items.length > 0) {
      console.log(`Found ${data.items.length} videos:`);
      data.items.forEach((item, index) => {
        console.log(`${index + 1}. ${item.snippet.title} by ${item.snippet.channelTitle}`);
      });
    } else {
      console.log('No videos found');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testYouTubeSearch();