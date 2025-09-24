"use client"

import React, { useState, useEffect } from "react"
import type { ReactNode } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { achievementService, type Achievement } from "@/lib/achievementService"
import {
  Trophy,
  Target,
  Calendar,
  Utensils,
  Clock,
  Star,
  Award,
  CheckCircle,
  Lock,
  Flame,
  Heart,
  Leaf,
  ChefHat,
} from "lucide-react"

interface AchievementWithIcon extends Achievement {
  icon: ReactNode
}

const getRarityColors = (rarity: string) => {
  switch (rarity) {
    case "common":
      return {
        outer: "#22c55e", // green-500
        ribbon: "#dc2626", // red-600
        text: "text-green-700",
        badge: "bg-green-100 text-green-700 border-green-300",
      }
    case "rare":
      return {
        outer: "#3b82f6", // blue-500
        ribbon: "#dc2626", // red-600
        text: "text-blue-700",
        badge: "bg-blue-100 text-blue-700 border-blue-300",
      }
    case "epic":
      return {
        outer: "#8b5cf6", // violet-500
        ribbon: "#dc2626", // red-600
        text: "text-purple-700",
        badge: "bg-purple-100 text-purple-700 border-purple-300",
      }
    case "legendary":
      return {
        outer: "#eab308", // yellow-500
        ribbon: "#dc2626", // red-600
        text: "text-orange-700",
        badge: "bg-yellow-100 text-orange-700 border-yellow-300",
      }
    default:
      return {
        outer: "#6b7280", // gray-500
        ribbon: "#6b7280", // gray-500
        text: "text-gray-700",
        badge: "bg-gray-100 text-gray-700 border-gray-300",
      }
  }
}

const MedalComponent = ({
  achievement,
  size = "small",
  onClick,
}: { achievement: AchievementWithIcon; size?: "small" | "large"; onClick?: () => void }) => {
  const colors = getRarityColors(achievement.rarity)
  const isLocked = !achievement.isUnlocked
  const isLarge = size === "large"
  const medalSize = isLarge ? 128 : 64
  const iconSize = isLarge ? "w-12 h-12" : "w-6 h-6"

  return (
    <div
      className={`relative ${isLarge ? "w-32 h-40" : "w-20 h-28"} mx-auto ${onClick ? "cursor-pointer" : ""} transition-all duration-300 hover:scale-110 ${isLocked ? "opacity-60" : ""}`}
      onClick={onClick}
    >
      {/* Medal Circle */}
      <div className={`relative ${isLarge ? "w-32 h-32" : "w-16 h-16"} mx-auto`}>
        {/* Outer Scalloped Ring */}
        <svg
          width={medalSize}
          height={medalSize}
          viewBox={`0 0 ${medalSize} ${medalSize}`}
          className="absolute inset-0"
        >
          <circle
            cx={medalSize / 2}
            cy={medalSize / 2}
            r={medalSize / 2 - 2}
            fill={isLocked ? "#9ca3af" : colors.outer}
            stroke={isLocked ? "#6b7280" : colors.outer}
            strokeWidth="2"
            style={{
              filter: `drop-shadow(0 2px 4px rgba(0,0,0,0.1))`,
            }}
          />
          {/* Scalloped edge pattern */}
          <g>
            {Array.from({ length: isLarge ? 32 : 24 }, (_, i) => {
              const angle = i * (360 / (isLarge ? 32 : 24)) * (Math.PI / 180)
              const x = medalSize / 2 + Math.cos(angle) * (medalSize / 2 - 4)
              const y = medalSize / 2 + Math.sin(angle) * (medalSize / 2 - 4)
              return (
                <circle key={i} cx={x} cy={y} r={isLarge ? "3" : "2"} fill={isLocked ? "#9ca3af" : colors.outer} />
              )
            })}
          </g>
        </svg>

        {/* Inner Red Ring */}
        <div
          className={`absolute ${isLarge ? "inset-4" : "inset-2"} rounded-full`}
          style={{ backgroundColor: colors.ribbon }}
        >
          {/* White Center */}
          <div
            className={`absolute ${isLarge ? "inset-2" : "inset-1"} bg-white rounded-full flex items-center justify-center`}
          >
            {/* Achievement Icon */}
            <div className={`${isLocked ? "text-gray-400" : "text-gray-700"}`}>
              {isLocked ? (
                <Lock className={iconSize} />
              ) : (
                React.cloneElement(achievement.icon as React.ReactElement, { className: iconSize })
              )}
            </div>
          </div>
        </div>

        {/* Points Badge */}
        <div
          className={`absolute ${isLarge ? "-top-2 -right-2 w-10 h-10" : "-top-1 -right-1 w-6 h-6"} bg-yellow-500 rounded-full flex items-center justify-center border-2 border-white shadow-lg`}
        >
          <span className={`text-white ${isLarge ? "text-sm" : "text-xs"} font-bold`}>
            {isLocked ? "?" : achievement.points}
          </span>
        </div>

        {/* Completion Checkmark */}
        {!isLocked && (
          <div
            className={`absolute ${isLarge ? "-top-2 -left-2 w-8 h-8" : "-top-1 -left-1 w-5 h-5"} bg-green-500 rounded-full flex items-center justify-center border-2 border-white shadow-lg`}
          >
            <CheckCircle className={`${isLarge ? "w-5 h-5" : "w-3 h-3"} text-white`} />
          </div>
        )}
      </div>

      {/* Ribbon Banner */}
      <div
        className={`absolute ${isLarge ? "top-24 w-16 h-12" : "top-12 w-8 h-6"} left-1/2 transform -translate-x-1/2`}
      >
        <svg
          width={isLarge ? "64" : "32"}
          height={isLarge ? "48" : "24"}
          viewBox={`0 0 ${isLarge ? "64" : "32"} ${isLarge ? "48" : "24"}`}
        >
          <path
            d={isLarge ? "M0 0 L64 0 L64 32 L32 48 L0 32 Z" : "M0 0 L32 0 L32 16 L16 24 L0 16 Z"}
            fill={isLocked ? "#6b7280" : colors.ribbon}
            style={{
              filter: `drop-shadow(0 2px 4px rgba(0,0,0,0.2))`,
            }}
          />
        </svg>
      </div>
    </div>
  )
}

const AchievementBadge = ({ achievement, onSelect }: { achievement: AchievementWithIcon; onSelect: (achievement: AchievementWithIcon) => void }) => {
  return (
    <div className="relative group">
      <MedalComponent achievement={achievement} size="small" onClick={() => onSelect(achievement)} />

      {/* Badge Info */}
      <div className="mt-2 text-center">
        <h3
          className={`font-medium text-xs leading-tight ${!achievement.isUnlocked ? "text-gray-500" : "text-gray-900"}`}
        >
          {achievement.title}
        </h3>

        {/* Rarity Badge */}
        <div className="flex justify-center mt-1">
          <Badge className={`text-xs px-1.5 py-0.5 ${getRarityColors(achievement.rarity).badge}`}>
            {achievement.rarity}
          </Badge>
        </div>

        {/* Progress for locked achievements */}
        {!achievement.isUnlocked && (
          <div className="mt-2 space-y-1">
            <div className="text-xs text-gray-500">
              {achievement.progress}/{achievement.maxProgress}
            </div>
            <Progress value={(achievement.progress / achievement.maxProgress) * 100} className="h-1" />
          </div>
        )}

        {/* Unlock Date */}
        {achievement.isUnlocked && achievement.unlockedDate && (
          <p className="text-xs text-green-600 mt-1 opacity-75">
            {new Date(achievement.unlockedDate).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  )
}

// Helper function to get achievement icon
const getAchievementIcon = (achievementId: string): ReactNode => {
  switch (achievementId) {
    case "first_steps":
      return <Star className="w-5 h-5" />
    case "meal_prep_master":
      return <ChefHat className="w-5 h-5" />
    case "streak_starter":
      return <Flame className="w-5 h-5" />
    case "monthly_planner":
      return <Calendar className="w-5 h-5" />
    case "recipe_explorer":
      return <Utensils className="w-5 h-5" />
    case "meal_planning_legend":
      return <Trophy className="w-5 h-5" />
    default:
      return <Trophy className="w-5 h-5" />
  }
}

interface AchievementsContainerProps {
  className?: string
}

export default function AchievementsContainer({ className = "" }: AchievementsContainerProps) {
  const [selectedAchievement, setSelectedAchievement] = useState<AchievementWithIcon | null>(null)
  const [achievements, setAchievements] = useState<AchievementWithIcon[]>([])
  const [totalPoints, setTotalPoints] = useState(0)
  const [unlockedCount, setUnlockedCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)

  // Load achievements from service
  useEffect(() => {
    const loadAchievements = async () => {
      try {
        const rawAchievements = await achievementService.getAchievements()
        const achievementsWithIcons: AchievementWithIcon[] = rawAchievements.map(achievement => ({
          ...achievement,
          icon: getAchievementIcon(achievement.id)
        }))
        setAchievements(achievementsWithIcons)

        // Update stats
        const points = await achievementService.getTotalPoints()
        const unlocked = await achievementService.getUnlockedCount()
        const total = await achievementService.getTotalCount()
        
        setTotalPoints(points)
        setUnlockedCount(unlocked)
        setTotalCount(total)
      } catch (error) {
        console.error('Error loading achievements:', error)
      }
    }

    loadAchievements()

    // Listen for achievement updates
    const cleanup = achievementService.onAchievementUnlock(() => {
      loadAchievements()
    })

    return cleanup
  }, [])

  return (
    <div className={className}>
      <Card className="bg-white/50 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-purple-600" />
            Achievements
          </CardTitle>
          <p className="text-sm text-gray-600">Track your meal planning progress and unlock rewards</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gradient-to-r from-purple-50 to-emerald-50 p-4 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Trophy className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900">{totalPoints}</p>
                  <p className="text-sm text-gray-600">Total Points</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-50 to-emerald-50 p-4 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900">
                    {unlockedCount}/{totalCount}
                  </p>
                  <p className="text-sm text-gray-600">Achievements</p>
                </div>
              </div>
            </div>
          </div>

          {/* Achievement Badges Container */}
          <div className="bg-gradient-to-r from-purple-50 to-emerald-50 rounded-lg p-4">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Your Achievements</h3>
              <p className="text-sm text-gray-600">Click on any achievement to view details</p>
            </div>
            <div className="h-80 overflow-y-auto">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {achievements.map((achievement) => (
                  <AchievementBadge key={achievement.id} achievement={achievement} onSelect={setSelectedAchievement} />
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Achievement Detail Modal */}
      <Dialog open={!!selectedAchievement} onOpenChange={() => setSelectedAchievement(null)}>
        <DialogContent className="max-w-md">
          {selectedAchievement && (
            <>
              <DialogHeader>
                <DialogTitle className="text-center text-xl font-bold">{selectedAchievement.title}</DialogTitle>
              </DialogHeader>

              <div className="flex flex-col items-center space-y-4 py-4">
                {/* Large Medal */}
                <MedalComponent achievement={selectedAchievement} size="large" />

                {/* Achievement Details */}
                <div className="text-center space-y-3">
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {selectedAchievement.isUnlocked ? selectedAchievement.description : "???"}
                  </p>

                  <div className="flex justify-center">
                    <Badge className={`${getRarityColors(selectedAchievement.rarity).badge} px-3 py-1`}>
                      {selectedAchievement.rarity.toUpperCase()}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="text-center">
                      <p className="font-semibold text-gray-900">{selectedAchievement.points}</p>
                      <p className="text-gray-500">Points</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-gray-900">{selectedAchievement.category}</p>
                      <p className="text-gray-500">Category</p>
                    </div>
                  </div>

                  {selectedAchievement.isUnlocked ? (
                    selectedAchievement.unlockedDate && (
                      <div className="text-center">
                        <p className="text-green-600 font-medium">Unlocked</p>
                        <p className="text-gray-500 text-sm">
                          {new Date(selectedAchievement.unlockedDate).toLocaleDateString()}
                        </p>
                      </div>
                    )
                  ) : (
                    <div className="space-y-2">
                      <div className="text-center">
                        <p className="text-gray-500 font-medium">Progress</p>
                        <p className="text-gray-900 font-semibold">
                          {selectedAchievement.progress} / {selectedAchievement.maxProgress}
                        </p>
                      </div>
                      <Progress
                        value={(selectedAchievement.progress / selectedAchievement.maxProgress) * 100}
                        className="h-2"
                      />
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}