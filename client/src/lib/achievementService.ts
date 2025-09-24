/**
 * Achievement Service - Database-backed achievement tracking
 */

import { apiRequest } from './queryClient'

export interface Achievement {
  id: string
  title: string
  description: string
  category: string
  isUnlocked: boolean
  progress: number
  maxProgress: number
  points: number
  unlockedDate?: string
  rarity: "common" | "rare" | "epic" | "legendary"
}

export interface AchievementUnlockResult {
  achievement: Achievement
  isNewUnlock: boolean
  pointsEarned: number
}

class AchievementService {
  private notificationCallbacks: ((result: AchievementUnlockResult) => void)[] = []
  private isInitialized = false

  private convertDbAchievementToAchievement(dbAchievement: any): Achievement {
    return {
      id: dbAchievement.achievement_id,
      title: dbAchievement.title,
      description: dbAchievement.description,
      category: dbAchievement.category,
      isUnlocked: dbAchievement.is_unlocked,
      progress: dbAchievement.progress,
      maxProgress: dbAchievement.max_progress,
      points: dbAchievement.points,
      unlockedDate: dbAchievement.unlocked_date,
      rarity: dbAchievement.rarity
    }
  }

  private async getAuthToken(): Promise<string | null> {
    return localStorage.getItem('auth_token')
  }

  public async getAchievements(): Promise<Achievement[]> {
    try {
      const token = await this.getAuthToken()
      if (!token) {
        console.warn('No auth token available for achievements')
        return []
      }

      const response = await fetch('/api/achievements', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch achievements: ${response.statusText}`)
      }

      const dbAchievements = await response.json()
      return dbAchievements.map((dbAch: any) => this.convertDbAchievementToAchievement(dbAch))
    } catch (error) {
      console.error('Error fetching achievements:', error)
      return []
    }
  }

  public async getAchievement(id: string): Promise<Achievement | null> {
    try {
      const token = await this.getAuthToken()
      if (!token) {
        console.warn('No auth token available for achievement')
        return null
      }

      const response = await fetch(`/api/achievements/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        if (response.status === 404) {
          return null
        }
        throw new Error(`Failed to fetch achievement: ${response.statusText}`)
      }

      const dbAchievement = await response.json()
      return this.convertDbAchievementToAchievement(dbAchievement)
    } catch (error) {
      console.error('Error fetching achievement:', error)
      return null
    }
  }

  public onAchievementUnlock(callback: (result: AchievementUnlockResult) => void) {
    this.notificationCallbacks.push(callback)
    
    // Return cleanup function
    return () => {
      const index = this.notificationCallbacks.indexOf(callback)
      if (index > -1) {
        this.notificationCallbacks.splice(index, 1)
      }
    }
  }

  private notifyUnlock(result: AchievementUnlockResult) {
    this.notificationCallbacks.forEach(callback => {
      try {
        callback(result)
      } catch (error) {
        console.error('Achievement notification callback error:', error)
      }
    })
  }

  public async trackMealPlanCreated(): Promise<AchievementUnlockResult[]> {
    const results: AchievementUnlockResult[] = []
    
    console.log('🎯 Achievement Service: Tracking meal plan creation...')
    
    try {
      const token = await this.getAuthToken()
      if (!token) {
        console.warn('No auth token available for achievement tracking')
        return results
      }

      // Trigger "first_steps" achievement
      const response = await fetch('/api/achievements/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          achievementId: 'first_steps'
        })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.isNewlyUnlocked) {
          const achievement = this.convertDbAchievementToAchievement(data.achievement)
          const result: AchievementUnlockResult = {
            achievement,
            isNewUnlock: true,
            pointsEarned: achievement.points
          }
          
          console.log('🏆 Achievement unlocked:', achievement.title, `+${achievement.points} points`)
          results.push(result)
          this.notifyUnlock(result)
        } else {
          console.log('ℹ️ First Steps achievement already unlocked')
        }
      }
    } catch (error) {
      console.error('Error tracking meal plan creation:', error)
    }
    
    return results
  }

  public async getTotalPoints(): Promise<number> {
    const achievements = await this.getAchievements()
    return achievements
      .filter(a => a.isUnlocked)
      .reduce((sum, a) => sum + a.points, 0)
  }

  public async getUnlockedCount(): Promise<number> {
    const achievements = await this.getAchievements()
    return achievements.filter(a => a.isUnlocked).length
  }

  public async getTotalCount(): Promise<number> {
    const achievements = await this.getAchievements()
    return achievements.length
  }
}

// Export singleton instance
export const achievementService = new AchievementService()

// Make available for testing in browser console
if (typeof window !== 'undefined') {
  ;(window as any).achievementService = achievementService
  // console.log('🎮 Achievement service available in console as window.achievementService')
  // console.log('📚 Available methods: trackMealPlanCreated(), getAchievements()')
}