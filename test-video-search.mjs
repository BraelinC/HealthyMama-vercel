import { findBestRecipeVideo } from './server/videoRecipeExtractor.js';

console.log('Starting video search test...');

try {
  const result = await findBestRecipeVideo('scrambled eggs');
  console.log('Result:', result);
} catch (error) {
  console.error('Error:', error);
}