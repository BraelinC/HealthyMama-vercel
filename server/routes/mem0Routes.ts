import express from 'express';
import { Mem0ChatService } from '../mem0/Mem0ChatService';
import { ProfileSyncService } from '../mem0/ProfileSyncService';
import { mapProfilePayloadToUltraThink, buildProfileMemorySummary, computeProfileSignature, collectPreferenceCategories } from '../mem0/profileUtils';

const router = express.Router();
const chatService = new Mem0ChatService();
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

// Send message to UltraThink
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
    console.error('[MEM0 CHAT ROUTE ERROR]', error);
    res.status(500).json({
      error: error.message || 'Internal server error',
      engine: 'mem0'
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
    console.error('[MEM0 PREVIEW ROUTE ERROR]', error);
    res.status(500).json({
      error: error.message || 'Internal server error',
      engine: 'mem0'
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
    console.error('[MEM0 SESSIONS ROUTE ERROR]', error);
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
    console.error('[MEM0 HISTORY ROUTE ERROR]', error);
    res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
});

// ===== RECIPE ROUTES =====

// Intelligent recipe search
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
    console.error('[MEM0 RECIPE SEARCH ROUTE ERROR]', error);
    res.status(500).json({
      error: error.message || 'Internal server error',
      engine: 'mem0'
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
    console.error('[MEM0 FEEDBACK ROUTE ERROR]', error);
    res.status(500).json({
      error: error.message || 'Internal server error',
      engine: 'mem0'
    });
  }
});

// ===== PROFILE & MEMORY ROUTES =====

// Sync user profile to mem0
router.post('/profile/sync', async (req, res) => {
  try {
    const { communityId, profile, syncType } = req.body;
    const userId = getUserId(req);

    if (profile) {
      const mapped = mapProfilePayloadToUltraThink(profile);
      const syncResult = await profileSyncService.syncUserProfile(userId, mapped || undefined);

      res.json({
        ...syncResult,
        summary: mapped ? buildProfileMemorySummary(mapped) : undefined,
        preferenceCategories: mapped ? collectPreferenceCategories(mapped) : undefined,
        profileSignature: mapped ? computeProfileSignature(mapped) : undefined,
        syncType: syncType || 'profile:update',
      });
      return;
    }

    const results = await profileSyncService.fullUserSync(
      userId,
      communityId ? parseInt(communityId) : undefined
    );

    res.json(results);
  } catch (error: any) {
    console.error('[MEM0 PROFILE SYNC ROUTE ERROR]', error);
    res.status(500).json({
      error: error.message || 'Internal server error',
      engine: 'mem0'
    });
  }
});

// Store cultural preferences
router.post('/profile/cultural', async (req, res) => {
  try {
    const { culturalData } = req.body;
    const userId = getUserId(req);

    if (!culturalData) {
      return res.status(400).json({
        error: 'Missing required field: culturalData'
      });
    }

    const result = await profileSyncService.storeCulturalPreferences(userId, culturalData);
    res.json(result);
  } catch (error: any) {
    console.error('[MEM0 CULTURAL ROUTE ERROR]', error);
    res.status(500).json({
      error: error.message || 'Internal server error'
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
    console.error('[MEM0 INSIGHTS ROUTE ERROR]', error);
    res.status(500).json({
      error: error.message || 'Internal server error',
      engine: 'mem0'
    });
  }
});

// Clear user memories (privacy feature)
router.delete('/memory/clear', async (req, res) => {
  try {
    const userId = getUserId(req);
    const result = await chatService.clearUserMemories(userId);
    res.json(result);
  } catch (error: any) {
    console.error('[MEM0 CLEAR ROUTE ERROR]', error);
    res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
});

// ===== COOKBOOK ROUTES =====

// Sync cookbook entries for a community
router.post('/cookbook/sync', async (req, res) => {
  try {
    const { communityId } = req.body;
    const userId = getUserId(req); // For authorization

    if (!communityId) {
      return res.status(400).json({
        error: 'Missing required field: communityId'
      });
    }

    const result = await profileSyncService.syncCookbookEntries(parseInt(communityId));
    res.json(result);
  } catch (error: any) {
    console.error('[MEM0 COOKBOOK SYNC ROUTE ERROR]', error);
    res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
});

// ===== SYSTEM ROUTES =====

// Health check for mem0 system
router.get('/health', async (req, res) => {
  try {
    const userId = req.user?.id;

    const health = {
      status: 'healthy',
      engine: 'mem0',
      timestamp: new Date().toISOString(),
      user: userId ? 'authenticated' : 'anonymous',
      components: {
        memoryEngine: 'operational',
        chatService: 'operational',
        profileSync: 'operational'
      }
    };

    res.json(health);
  } catch (error: any) {
    console.error('[MEM0 HEALTH ROUTE ERROR]', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      engine: 'mem0'
    });
  }
});

// Get system stats (for debugging)
router.get('/stats', async (req, res) => {
  try {
    const userId = getUserId(req);
    const insights = await chatService.getUserMemoryInsights(userId);

    const stats = {
      userId,
      engine: 'mem0',
      timestamp: new Date().toISOString(),
      memory: insights,
      system: {
        nodeEnv: process.env.NODE_ENV,
        hasGoogleApiKey: !!process.env.GOOGLE_API_KEY,
        hasOpenAIKey: !!process.env.OPENAI_API_KEY
      }
    };

    res.json(stats);
  } catch (error: any) {
    console.error('[MEM0 STATS ROUTE ERROR]', error);
    res.status(500).json({
      error: error.message || 'Internal server error',
      engine: 'mem0'
    });
  }
});

export default router;