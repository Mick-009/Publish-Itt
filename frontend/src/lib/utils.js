import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export const statusColors = {
  concept: "bg-slate-100 text-slate-700 border-slate-200",
  outline: "bg-blue-100 text-blue-700 border-blue-200",
  draft: "bg-yellow-100 text-yellow-700 border-yellow-200",
  revisions: "bg-orange-100 text-orange-700 border-orange-200",
  editing: "bg-purple-100 text-purple-700 border-purple-200",
  layout: "bg-indigo-100 text-indigo-700 border-indigo-200",
  art: "bg-pink-100 text-pink-700 border-pink-200",
  proofing: "bg-cyan-100 text-cyan-700 border-cyan-200",
  final: "bg-emerald-100 text-emerald-700 border-emerald-200",
  published: "bg-green-100 text-green-700 border-green-200",
}

export const workflowStages = [
  "concept",
  "outline",
  "draft",
  "revisions",
  "editing",
  "layout",
  "art",
  "proofing",
  "final",
  "published"
]

export const formatDate = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

export const formatWordCount = (count) => {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`
  }
  return count.toString()
}

export const calculateProgress = (status) => {
  const index = workflowStages.indexOf(status)
  if (index === -1) return 0
  return Math.round(((index + 1) / workflowStages.length) * 100)
}
