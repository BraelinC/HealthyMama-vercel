import express from 'express';
import { SimplifiedMem0ChatService } from '../mem0/SimplifiedMem0ChatService';
import { ProfileSyncService } from '../mem0/ProfileSyncService';

const router = express.Router();
const chatService = new SimplifiedMem0ChatService();
const profileSyncService = new ProfileSyncService();

// Helper function to get user ID from request
const getUserId = (req: any): string => {
  const userId = req.user?.id;
  if (!userId) {
    throw new Error('User not authenticated');
  }
  return userId;
};

// ===== CHAT ROUTES =====

// Send message to Simplified UltraThink with streaming
router.post('/chat/stream', async (req, res) => {
  // Set headers for Server-Sent Events
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Accel-Buffering', 'no');

  // Helper function to send SSE data
  const sendData = (data: string) => {
    res.write(`data: ${data}\n\n`);
    if (typeof (res as any).flush === 'function') {
      (res as any).flush();
    }
  };

  try {
    const { communityId, message, sessionId } = req.body;
    const userId = getUserId(req);

    if (!communityId || !message) {
      sendData(JSON.stringify({ error: 'Missing required fields: communityId, message' }));
      return res.end();
    }

    // Process with streaming UltraThink
    const result = await chatService.sendMessageStream({
      userId,
      communityId: parseInt(communityId),
      message: message.trim(),
      sessionId,
      onChunk: (chunk: string) => {
        sendData(JSON.stringify({ type: 'chunk', data: chunk }));
      },
      onComplete: (finalResult: any) => {
        sendData(JSON.stringify({ type: 'complete', data: finalResult }));
        res.end();
      }
    });

  } catch (error: any) {
    console.error('[SIMPLIFIED MEM0 STREAM ERROR]', error);
    sendData(JSON.stringify({
      error: error.message || 'Internal server error',
      engine: 'simplified-ultrathink'
    }));
    res.end();
  }
});

// Send message to Simplified UltraThink
router.post('/chat', async (req, res) => {
  try {
    const { communityId, message, sessionId } = req.body;
    const userId = getUserId(req);

    if (!communityId || !message) {
      return res.status(400).json({
        error: 'Missing required fields: communityId, message'
      });
    }

    const result = await chatService.sendMessage({
      userId,
      communityId: parseInt(communityId),
      message: message.trim(),
      sessionId
    });

    res.json(result);
  } catch (error: any) {
    console.error('[SIMPLIFIED MEM0 CHAT ROUTE ERROR]', error);
    res.status(500).json({
      error: error.message || 'Internal server error',
      engine: 'simplified-ultrathink'
    });
  }
});

// Preview message response
router.post('/chat/preview', async (req, res) => {
  try {
    const { communityId, message } = req.body;
    const userId = getUserId(req);

    if (!communityId || !message) {
      return res.status(400).json({
        error: 'Missing required fields: communityId, message'
      });
    }

    const result = await chatService.previewResponse({
      userId,
      communityId: parseInt(communityId),
      message: message.trim()
    });

    res.json(result);
  } catch (error: any) {
    console.error('[SIMPLIFIED MEM0 PREVIEW ROUTE ERROR]', error);
    res.status(500).json({
      error: error.message || 'Internal server error',
      engine: 'simplified-ultrathink'
    });
  }
});

// Get chat sessions
router.get('/chat/sessions', async (req, res) => {
  try {
    const { communityId } = req.query;
    const userId = getUserId(req);

    if (!communityId) {
      return res.status(400).json({
        error: 'Missing required parameter: communityId'
      });
    }

    const sessions = await chatService.listSessions(userId, parseInt(communityId as string));
    res.json(sessions);
  } catch (error: any) {
    console.error('[SIMPLIFIED MEM0 SESSIONS ROUTE ERROR]', error);
    res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
});

// Get chat history
router.get('/chat/history', async (req, res) => {
  try {
    const { sessionId, communityId } = req.query;
    const userId = getUserId(req);

    if (!sessionId || !communityId) {
      return res.status(400).json({
        error: 'Missing required parameters: sessionId, communityId'
      });
    }

    const history = await chatService.getHistory(
      userId,
      parseInt(communityId as string),
      sessionId as string
    );

    res.json(history);
  } catch (error: any) {
    console.error('[SIMPLIFIED MEM0 HISTORY ROUTE ERROR]', error);
    res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
});

// ===== RECIPE ROUTES =====

// Simplified recipe search
router.post('/recipes/search', async (req, res) => {
  try {
    const { query, creatorId } = req.body;
    const userId = getUserId(req);

    if (!query) {
      return res.status(400).json({
        error: 'Missing required field: query'
      });
    }

    const results = await chatService.searchRecipes({
      userId,
      query: query.trim(),
      creatorId: creatorId?.trim()
    });

    res.json(results);
  } catch (error: any) {
    console.error('[SIMPLIFIED MEM0 RECIPE SEARCH ROUTE ERROR]', error);
    res.status(500).json({
      error: error.message || 'Internal server error',
      engine: 'simplified-ultrathink'
    });
  }
});

// Store recipe feedback
router.post('/recipes/feedback', async (req, res) => {
  try {
    const { recipeId, feedback } = req.body;
    const userId = getUserId(req);

    if (!recipeId || !feedback) {
      return res.status(400).json({
        error: 'Missing required fields: recipeId, feedback'
      });
    }

    const result = await chatService.storeRecipeFeedback({
      userId,
      recipeId,
      feedback
    });

    res.json(result);
  } catch (error: any) {
    console.error('[SIMPLIFIED MEM0 FEEDBACK ROUTE ERROR]', error);
    res.status(500).json({
      error: error.message || 'Internal server error',
      engine: 'simplified-ultrathink'
    });
  }
});

// ===== PROFILE & MEMORY ROUTES =====

// Sync user profile to simplified memory
router.post('/profile/sync', async (req, res) => {
  try {
    const { communityId, profile } = req.body;
    const userId = getUserId(req);

    let profilePayload = profile;
    if (!profilePayload) {
      // Fallback: load profile from DB and map it
      const existing = await profileSyncService.getUserProfile(userId);
      profilePayload = existing?.profile;
    }

    const result = await chatService.syncUserProfile(userId, profilePayload);

    res.json(result);
  } catch (error: any) {
    console.error('[SIMPLIFIED MEM0 PROFILE SYNC ROUTE ERROR]', error);
    res.status(500).json({
      error: error.message || 'Internal server error',
      engine: 'simplified-ultrathink'
    });
  }
});

// Get mapped user profile from DB (for debugging/clients)
router.get('/profile', async (req, res) => {
  try {
    const userId = getUserId(req);
    const result = await profileSyncService.getUserProfile(userId);
    if (!result) {
      return res.status(404).json({ message: 'No profile found' });
    }
    res.json(result);
  } catch (error: any) {
    console.error('[SIMPLIFIED MEM0 PROFILE GET ROUTE ERROR]', error);
    res.status(500).json({
      error: error.message || 'Internal server error',
      engine: 'simplified-ultrathink'
    });
  }
});

// Get memory insights
router.get('/memory/insights', async (req, res) => {
  try {
    const userId = getUserId(req);
    const insights = await chatService.getUserMemoryInsights(userId);
    res.json(insights);
  } catch (error: any) {
    console.error('[SIMPLIFIED MEM0 INSIGHTS ROUTE ERROR]', error);
    res.status(500).json({
      error: error.message || 'Internal server error',
      engine: 'simplified-ultrathink'
    });
  }
});

// Clear user memories
router.delete('/memory/clear', async (req, res) => {
  try {
    const userId = getUserId(req);
    const result = await chatService.clearUserMemories(userId);
    res.json(result);
  } catch (error: any) {
    console.error('[SIMPLIFIED MEM0 CLEAR ROUTE ERROR]', error);
    res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
});

// ===== SYSTEM ROUTES =====

// Health check for simplified system
router.get('/health', async (req, res) => {
  try {
    const userId = req.user?.id;

    const health = {
      status: 'healthy',
      engine: 'simplified-ultrathink',
      timestamp: new Date().toISOString(),
      user: userId ? 'authenticated' : 'anonymous',
      components: {
        simplifiedUltraThink: 'operational',
        chatService: 'operational'
      }
    };

    res.json(health);
  } catch (error: any) {
    console.error('[SIMPLIFIED MEM0 HEALTH ROUTE ERROR]', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      engine: 'simplified-ultrathink'
    });
  }
});

// Get system stats
router.get('/stats', async (req, res) => {
  try {
    const userId = getUserId(req);
    const insights = await chatService.getUserMemoryInsights(userId);

    const stats = {
      userId,
      engine: 'simplified-ultrathink',
      timestamp: new Date().toISOString(),
      memory: insights,
      system: {
        nodeEnv: process.env.NODE_ENV,
        hasOpenAIKey: !!process.env.OPENAI_API_KEY,
        fullMem0Disabled: true,
        usingSimplified: true
      }
    };

    res.json(stats);
  } catch (error: any) {
    console.error('[SIMPLIFIED MEM0 STATS ROUTE ERROR]', error);
    res.status(500).json({
      error: error.message || 'Internal server error',
      engine: 'simplified-ultrathink'
    });
  }
});

export default router;