/**
 * Achievement Notification Component - Shows achievement unlock notifications
 */

import React, { useState, useEffect } from "react"
import { Trophy, X, Star, ChefHat, Target, Calendar, Medal, Crown } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { achievementService, type AchievementUnlockResult } from "@/lib/achievementService"

interface NotificationProps {
  result: AchievementUnlockResult
  onClose: () => void
}

const AchievementNotificationItem = ({ result, onClose }: NotificationProps) => {
  const { achievement, pointsEarned } = result
  
  const getAchievementIcon = (achievementId: string, rarity: string) => {
    switch (achievementId) {
      case "first_steps":
        return <ChefHat className="w-6 h-6" />
      case "meal_prep_master":
        return <Calendar className="w-6 h-6" />
      case "streak_starter":
        return <Target className="w-6 h-6" />
      case "nutrition_ninja":
        return <Medal className="w-6 h-6" />
      case "variety_virtuoso":
        return <Star className="w-6 h-6" />
      case "meal_planning_legend":
        return <Crown className="w-6 h-6" />
      default:
        return <Trophy className="w-6 h-6" />
    }
  }
  
  const getRarityColors = (rarity: string) => {
    switch (rarity) {
      case "common":
        return {
          bg: "bg-green-50 border-green-200",
          text: "text-green-800",
          badge: "bg-green-100 text-green-700 border-green-300",
          icon: "text-green-600"
        }
      case "rare":
        return {
          bg: "bg-blue-50 border-blue-200", 
          text: "text-blue-800",
          badge: "bg-blue-100 text-blue-700 border-blue-300",
          icon: "text-blue-600"
        }
      case "epic":
        return {
          bg: "bg-purple-50 border-purple-200",
          text: "text-purple-800", 
          badge: "bg-purple-100 text-purple-700 border-purple-300",
          icon: "text-purple-600"
        }
      case "legendary":
        return {
          bg: "bg-yellow-50 border-yellow-200",
          text: "text-orange-800",
          badge: "bg-yellow-100 text-orange-700 border-yellow-300", 
          icon: "text-orange-600"
        }
      default:
        return {
          bg: "bg-gray-50 border-gray-200",
          text: "text-gray-800",
          badge: "bg-gray-100 text-gray-700 border-gray-300",
          icon: "text-gray-600"
        }
    }
  }

  const colors = getRarityColors(achievement.rarity)

  return (
    <Card className={`${colors.bg} border-2 shadow-lg animate-in slide-in-from-right duration-500`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-full bg-white ${colors.icon}`}>
              {getAchievementIcon(achievement.id, achievement.rarity)}
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className={`font-bold text-lg ${colors.text}`}>Achievement Unlocked!</h3>
                <Badge className={`${colors.badge} text-xs px-2 py-0.5`}>
                  {achievement.rarity.toUpperCase()}
                </Badge>
              </div>
              
              <h4 className={`font-semibold ${colors.text} mb-1`}>
                {achievement.title}
              </h4>
              
              <p className="text-sm text-gray-600 mb-2">
                {achievement.description}
              </p>
              
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-500" />
                  <span className={`font-medium ${colors.text}`}>
                    +{pointsEarned} points
                  </span>
                </div>
                
                <div className={`text-xs ${colors.text} opacity-75`}>
                  {achievement.category}
                </div>
              </div>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 hover:bg-white/50"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function AchievementNotification() {
  const [notifications, setNotifications] = useState<AchievementUnlockResult[]>([])

  useEffect(() => {
    const cleanup = achievementService.onAchievementUnlock((result) => {
      setNotifications(prev => [...prev, result])
      
      // Auto-hide after 8 seconds
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n !== result))
      }, 8000)
    })

    return cleanup
  }, [])

  const removeNotification = (result: AchievementUnlockResult) => {
    setNotifications(prev => prev.filter(n => n !== result))
  }

  if (notifications.length === 0) {
    return null
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map((result, index) => (
        <AchievementNotificationItem
          key={`${result.achievement.id}-${index}`}
          result={result}
          onClose={() => removeNotification(result)}
        />
      ))}
    </div>
  )
}