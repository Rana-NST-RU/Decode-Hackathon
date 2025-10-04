import { githubAPI } from './github-api';

export async function analyzeIssue(issue, assigneeActivity, repoStats) {
  try {
    if (!issue.assignee || !assigneeActivity) {
      return {
        completionProbability: 0,
        estimatedDays: 0,
        isUserActive: false,
        risk: 'high',
        reasoning: 'No assignee or activity data available',
        recommendation: 'Assign to an active contributor'
      };
    }

    const daysSinceUpdate = (Date.now() - new Date(issue.updated_at).getTime()) / (1000 * 60 * 60 * 24);
    const daysSinceCreated = (Date.now() - new Date(issue.created_at).getTime()) / (1000 * 60 * 60 * 24);
    
    let completionProbability = 50;
    let risk = 'medium';
    
    if (assigneeActivity.reliabilityScore > 70) {
      completionProbability += 20;
    } else if (assigneeActivity.reliabilityScore < 40) {
      completionProbability -= 20;
    }
    
    if (assigneeActivity.activityPattern === 'high') {
      completionProbability += 15;
    } else if (assigneeActivity.activityPattern === 'low') {
      completionProbability -= 15;
    }
    
    if (daysSinceUpdate > 14) {
      completionProbability -= 30;
      risk = 'high';
    } else if (daysSinceUpdate > 7) {
      completionProbability -= 15;
      risk = 'medium';
    }
    
    completionProbability = Math.max(10, Math.min(90, completionProbability));
    
    const estimatedDays = Math.max(1, Math.round(assigneeActivity.avgTimeToClose * (1 + daysSinceUpdate / 30)));
    
    let recommendation = 'Monitor for progress';
    if (risk === 'high') {
      recommendation = 'Consider reassigning or nudging the assignee';
    } else if (completionProbability < 30) {
      recommendation = 'Issue may need attention or reassignment';
    }
    
    return {
      completionProbability: Math.round(completionProbability),
      estimatedDays,
      isUserActive: assigneeActivity.isActive,
      risk,
      reasoning: `Based on user's ${assigneeActivity.activityPattern} activity pattern and ${daysSinceUpdate.toFixed(1)} days since last update`,
      recommendation
    };
  } catch (error) {
    console.error('Error analyzing issue:', error);
    return {
      completionProbability: 50,
      estimatedDays: 7,
      isUserActive: false,
      risk: 'medium',
      reasoning: 'Unable to analyze - using default estimates',
      recommendation: 'Monitor this issue for activity'
    };
  }
}

export function getActivityStatus(lastUpdate) {
  const daysSince = (Date.now() - new Date(lastUpdate).getTime()) / (1000 * 60 * 60 * 24);
  
  if (daysSince < 1) return 'active';
  if (daysSince < 7) return 'away';
  return 'offline';
}

export function getRiskColor(risk) {
  switch (risk) {
    case 'low': return 'text-success';
    case 'medium': return 'text-warning';
    case 'high': return 'text-destructive';
    default: return 'text-muted-foreground';
  }
}

export function getCompletionColor(probability) {
  if (probability >= 70) return 'text-success';
  if (probability >= 40) return 'text-warning';
  return 'text-destructive';
}

export function getActivityBadgeColor(activity) {
  switch (activity) {
    case 'high': return 'bg-success/10 text-success border-success/20';
    case 'medium': return 'bg-warning/10 text-warning border-warning/20';
    case 'low': return 'bg-destructive/10 text-destructive border-destructive/20';
    default: return 'bg-muted/10 text-muted border-muted/20';
  }
}
