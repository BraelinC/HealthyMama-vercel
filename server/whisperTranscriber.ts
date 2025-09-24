import Groq from 'groq-sdk';
import ytdl from '@distube/ytdl-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
// import ffmpeg from 'fluent-ffmpeg';
// import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import dotenv from 'dotenv';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure env is loaded from project root
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Set FFmpeg path
// ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const unlink = promisify(fs.unlink);
const mkdir = promisify(fs.mkdir);

export class WhisperTranscriber {
  private client: Groq | null = null;
  private tempDir: string = path.join(__dirname, '../temp/audio');
  
  constructor() {
    // Use GROQ_API_KEY from Replit Secrets
    const groqApiKey = process.env.GROQ_API_KEY;
    
    if (groqApiKey) {
      console.log('🎙️ [WHISPER] Initializing with Whisper V3 Turbo');
      console.log('✅ [WHISPER] API key loaded successfully');
      this.client = new Groq({
        apiKey: groqApiKey
      });
      
      // Ensure temp directory exists
      this.ensureTempDir();
    } else {
      console.error('❌ [WHISPER] GROQ_API_KEY not found in environment');
    }
  }
  
  private async ensureTempDir() {
    try {
      await mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create temp directory:', error);
    }
  }
  
  /**
   * Download audio from YouTube video
   */
  async downloadAudio(videoUrl: string): Promise<string | null> {
    console.log('📥 [WHISPER] Downloading audio from YouTube...');
    
    try {
      // Get video info first
      const videoInfo = await ytdl.getInfo(videoUrl);
      const videoId = videoInfo.videoDetails.videoId;
      const duration = parseInt(videoInfo.videoDetails.lengthSeconds);
      
      console.log(`📺 [WHISPER] Video: ${videoInfo.videoDetails.title}`);
      console.log(`⏱️ [WHISPER] Duration: ${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`);
      
      // Create unique filename
      const tempFilePath = path.join(this.tempDir, `${videoId}_${Date.now()}.mp3`);
      
      // Download audio stream
      console.log('🎵 [WHISPER] Creating audio stream...');
      const audioStream = ytdl(videoUrl, {
        filter: 'audioonly',
        quality: 'lowestaudio',
        requestOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }
      });
      
      return new Promise((resolve, reject) => {
        // Convert to MP3 using FFmpeg
        // TEMPORARILY DISABLED - FFmpeg functionality commented out
        console.log('❌ [WHISPER] FFmpeg functionality disabled');
        reject(new Error('FFmpeg functionality is currently disabled'));
        
        /* 
        const command = ffmpeg(audioStream)
          .audioBitrate(128)
          .audioCodec('libmp3lame')
          .format('mp3')
          .on('error', (error) => {
            console.error('❌ [WHISPER] FFmpeg error:', error);
            reject(error);
          })
          .on('end', () => {
            console.log('✅ [WHISPER] Audio downloaded successfully');
            resolve(tempFilePath);
          })
          .on('progress', (progress) => {
            if (progress.percent) {
              console.log(`⏳ [WHISPER] Processing: ${Math.round(progress.percent)}%`);
            }
          });
        
        command.save(tempFilePath);
        */
      });
      
    } catch (error: any) {
      console.error('❌ [WHISPER] Download failed:', error.message);
      
      if (error.message?.includes('403') || error.message?.includes('Status code: 403')) {
        console.log('⚠️ [WHISPER] YouTube blocked the download (403 Forbidden)');
        console.log('💡 [WHISPER] This can happen with copyrighted content or age-restricted videos');
      } else if (error.message?.includes('404')) {
        console.log('⚠️ [WHISPER] Video not found (404)');
      } else {
        console.log('⚠️ [WHISPER] Unknown download error');
      }
      
      return null;
    }
  }
  
  /**
   * Split audio file into chunks for parallel processing
   */
  async splitAudioIntoChunks(audioPath: string, maxDurationMinutes: number = 5): Promise<string[]> {
    console.log(`✂️ [WHISPER] Splitting audio into ${maxDurationMinutes}-minute chunks...`);
    
    return new Promise((resolve, reject) => {
      const chunks: string[] = [];
      const maxDurationSeconds = maxDurationMinutes * 60;
      
      // Get audio duration first
      // TEMPORARILY DISABLED - FFmpeg ffprobe functionality commented out
      console.log('❌ [WHISPER] FFmpeg ffprobe disabled');
      reject(new Error('FFmpeg ffprobe functionality is currently disabled'));
      return;
      
      /* 
      ffmpeg.ffprobe(audioPath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }
        
        const duration = metadata.format.duration || 0;
        const numChunks = Math.ceil(duration / maxDurationSeconds);
        
        if (numChunks <= 1) {
          console.log('📝 [WHISPER] Audio is short enough, no splitting needed');
          resolve([audioPath]);
          return;
        }
        
        console.log(`📝 [WHISPER] Splitting into ${numChunks} chunks`);
        
        // Create chunks
        const promises: Promise<string>[] = [];
        
        for (let i = 0; i < numChunks; i++) {
          const startTime = i * maxDurationSeconds;
          const chunkPath = audioPath.replace('.mp3', `_chunk${i}.mp3`);
          chunks.push(chunkPath);
          
          promises.push(new Promise((resolveChunk, rejectChunk) => {
            ffmpeg(audioPath)
              .setStartTime(startTime)
              .setDuration(maxDurationSeconds)
              .audioCodec('libmp3lame')
              .on('end', () => {
                console.log(`✅ [WHISPER] Chunk ${i + 1}/${numChunks} created`);
                resolveChunk(chunkPath);
              })
              .on('error', rejectChunk)
              .save(chunkPath);
          }));
        }
        
        Promise.all(promises)
          .then(() => resolve(chunks))
          .catch(reject);
      });
      */
    });
  }
  
  /**
   * Transcribe audio file using Whisper V3 Turbo
   */
  async transcribeAudio(audioPath: string, chunkIndex?: number): Promise<string> {
    if (!this.client) {
      console.log('⚠️ [WHISPER] No client available');
      return '';
    }
    
    try {
      const chunkLabel = chunkIndex !== undefined ? ` (chunk ${chunkIndex + 1})` : '';
      console.log(`🎙️ [WHISPER] Transcribing audio${chunkLabel} with Whisper V3 Turbo...`);
      const startTime = Date.now();
      
      // Read audio file
      const audioBuffer = fs.readFileSync(audioPath);
      const fileName = path.basename(audioPath);
      
      // Get file size in MB
      const fileSizeMB = audioBuffer.length / (1024 * 1024);
      console.log(`📊 [WHISPER] File size: ${fileSizeMB.toFixed(2)} MB`);
      
      // Transcribe with Whisper V3 Turbo
      const transcription = await this.client.audio.transcriptions.create({
        file: new File([audioBuffer], fileName, { type: 'audio/mpeg' }),
        model: "whisper-large-v3-turbo",  // Using V3 Turbo for fast transcription
        response_format: "verbose_json",
        language: "en",  // Specify English for better accuracy
        temperature: 0.2  // Lower temperature for more accurate transcription
      });
      
      const timeTaken = Date.now() - startTime;
      console.log(`✅ [WHISPER] Transcription complete${chunkLabel} in ${timeTaken}ms`);
      
      // Log segments info if available
      if ((transcription as any).segments) {
        const segments = (transcription as any).segments;
        console.log(`📝 [WHISPER] Transcribed ${segments.length} segments`);
      }
      
      return transcription.text || '';
      
    } catch (error) {
      console.error('❌ [WHISPER] Transcription failed:', error);
      return '';
    }
  }
  
  /**
   * Transcribe YouTube video with automatic audio download
   */
  async transcribeYouTubeVideo(videoUrl: string): Promise<{
    transcript: string;
    duration: number;
    chunks?: number;
  } | null> {
    console.log('🚀 [WHISPER] Starting YouTube video transcription...');
    
    let audioPath: string | null = null;
    let chunkPaths: string[] = [];
    
    try {
      // Step 1: Download audio
      audioPath = await this.downloadAudio(videoUrl);
      if (!audioPath) {
        console.error('❌ [WHISPER] Failed to download audio');
        return null;
      }
      
      // Step 2: Get audio duration
      const duration = await this.getAudioDuration(audioPath);
      console.log(`⏱️ [WHISPER] Total duration: ${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`);
      
      // Step 3: Split if needed (>5 minutes)
      if (duration > 300) {  // 5 minutes = 300 seconds
        console.log('📊 [WHISPER] Audio is longer than 5 minutes, splitting for parallel processing...');
        chunkPaths = await this.splitAudioIntoChunks(audioPath, 5);
        
        // Step 4: Transcribe chunks in parallel
        console.log(`🚀 [WHISPER] Transcribing ${chunkPaths.length} chunks in parallel...`);
        const transcriptionPromises = chunkPaths.map((chunkPath, index) => 
          this.transcribeAudio(chunkPath, index)
        );
        
        const transcriptions = await Promise.all(transcriptionPromises);
        
        // Combine transcriptions
        const fullTranscript = transcriptions.join(' ');
        
        // Clean up chunk files
        await this.cleanupFiles(chunkPaths);
        
        return {
          transcript: fullTranscript,
          duration,
          chunks: chunkPaths.length
        };
        
      } else {
        // Step 4: Transcribe single file
        const transcript = await this.transcribeAudio(audioPath);
        
        return {
          transcript,
          duration,
          chunks: 1
        };
      }
      
    } catch (error) {
      console.error('❌ [WHISPER] YouTube transcription failed:', error);
      return null;
      
    } finally {
      // Clean up main audio file
      if (audioPath) {
        await this.cleanupFiles([audioPath]);
      }
    }
  }
  
  /**
   * Get audio duration in seconds
   */
  private async getAudioDuration(audioPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      // TEMPORARILY DISABLED - FFmpeg ffprobe functionality commented out
      console.log('❌ [WHISPER] FFmpeg ffprobe disabled');
      reject(new Error('FFmpeg ffprobe functionality is currently disabled'));
      return;
      
      /*
      ffmpeg.ffprobe(audioPath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          resolve(metadata.format.duration || 0);
        }
      });
      */
    });
  }
  
  /**
   * Clean up temporary files
   */
  private async cleanupFiles(filePaths: string[]) {
    for (const filePath of filePaths) {
      try {
        if (fs.existsSync(filePath)) {
          await unlink(filePath);
          console.log(`🧹 [WHISPER] Cleaned up: ${path.basename(filePath)}`);
        }
      } catch (error) {
        console.error(`Failed to delete ${filePath}:`, error);
      }
    }
  }
  
  /**
   * Transcribe with automatic fallback to Whisper if no transcript exists
   */
  async getTranscriptWithFallback(
    videoUrl: string, 
    existingTranscript?: string
  ): Promise<string> {
    // If we already have a transcript, use it
    if (existingTranscript && existingTranscript.length > 50) {
      console.log('✅ [WHISPER] Using existing transcript');
      return existingTranscript;
    }
    
    console.log('🔄 [WHISPER] No transcript found, using Whisper V3 Turbo...');
    
    // Download and transcribe
    const result = await this.transcribeYouTubeVideo(videoUrl);
    
    if (result && result.transcript) {
      console.log(`✅ [WHISPER] Generated transcript (${result.transcript.length} chars)`);
      if (result.chunks && result.chunks > 1) {
        console.log(`📊 [WHISPER] Processed ${result.chunks} chunks in parallel`);
      }
      return result.transcript;
    }
    
    console.log('❌ [WHISPER] Failed to generate transcript');
    return '';
  }
}

// Export singleton instance
export const whisperTranscriber = new WhisperTranscriber();