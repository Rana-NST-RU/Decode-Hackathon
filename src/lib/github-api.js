import axios from 'axios';

const GITHUB_API_BASE = 'https://api.github.com';

class GitHubAPI {
  getHeaders() {
    return {
      'Accept': 'application/vnd.github.v3+json',
    };
  }

  async getRepository(owner, repo) {
    const response = await axios.get(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, {
      headers: this.getHeaders(),
    });
    return response.data;
  }

  async getIssues(owner, repo, options = {}) {
    const params = new URLSearchParams({
      state: options.state || 'all',
      sort: options.sort || 'updated',
      direction: options.direction || 'desc',
      per_page: String(options.per_page || 30),
      page: String(options.page || 1),
      ...(options.labels && { labels: options.labels }),
      ...(options.assignee && { assignee: options.assignee }),
    });

    const response = await axios.get(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/issues?${params}`,
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  async getIssue(owner, repo, issueNumber) {
    const response = await axios.get(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/issues/${issueNumber}`,
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  async getContributors(owner, repo) {
    const response = await axios.get(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/contributors?per_page=100`,
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  async getUser(username) {
    const response = await axios.get(`${GITHUB_API_BASE}/users/${username}`, {
      headers: this.getHeaders(),
    });
    return response.data;
  }

  async getUserEvents(username, perPage = 30) {
    const response = await axios.get(`${GITHUB_API_BASE}/users/${username}/events/public?per_page=${perPage}`, {
      headers: this.getHeaders(),
    });
    return response.data;
  }

  async getUserCommits(owner, repo, username) {
    const response = await axios.get(`${GITHUB_API_BASE}/repos/${owner}/${repo}/commits?author=${username}&per_page=100`, {
      headers: this.getHeaders(),
    });
    return response.data;
  }

  async getUserPullRequests(owner, repo, username) {
    const response = await axios.get(`${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls?state=all&per_page=100`, {
      headers: this.getHeaders(),
    });
    return response.data.filter(pr => pr.user.login === username);
  }

  async getUserClosedIssues(owner, repo, username) {
    const response = await axios.get(`${GITHUB_API_BASE}/repos/${owner}/${repo}/issues?state=closed&assignee=${username}&per_page=100`, {
      headers: this.getHeaders(),
    });
    return response.data;
  }

  async getUserOpenIssues(owner, repo, username) {
    const response = await axios.get(`${GITHUB_API_BASE}/repos/${owner}/${repo}/issues?state=open&assignee=${username}&per_page=100`, {
      headers: this.getHeaders(),
    });
    return response.data;
  }

  async getUserActivity(owner, repo, username) {
    try {
      const [user, events, commits, prs] = await Promise.all([
        this.getUser(username),
        this.getUserEvents(username),
        this.getUserCommits(owner, repo, username),
        this.getUserPullRequests(owner, repo, username)
      ]);

      const mergedPRs = prs.filter(pr => pr.merged_at);
      const closedIssues = await this.getUserClosedIssues(owner, repo, username);
      const openIssues = await this.getUserOpenIssues(owner, repo, username);

      const avgTimeToClose = this.calculateAvgTimeToClose(prs, closedIssues);
      const reliabilityScore = this.calculateReliabilityScore(prs, mergedPRs, avgTimeToClose);
      const activityPattern = this.determineActivityPattern(events, commits);

      return {
        login: user.login,
        avatar_url: user.avatar_url,
        html_url: user.html_url,
        lastActivity: events[0]?.created_at || user.updated_at,
        totalCommits: commits.length,
        totalPRs: prs.length,
        mergedPRs: mergedPRs.length,
        openIssues: openIssues.length,
        closedIssues: closedIssues.length,
        avgTimeToClose,
        reliabilityScore,
        activityPattern,
        lastSeen: events[0]?.created_at || user.updated_at,
        isActive: this.isUserActive(events[0]?.created_at || user.updated_at)
      };
    } catch (error) {
      console.error('Error fetching user activity:', error);
      throw error;
    }
  }

  calculateAvgTimeToClose(prs, issues) {
    const allItems = [...prs, ...issues].filter(item => item.closed_at);
    if (allItems.length === 0) return 7;
    
    const totalDays = allItems.reduce((sum, item) => {
      const created = new Date(item.created_at);
      const closed = new Date(item.closed_at);
      return sum + (closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    }, 0);
    
    return Math.round(totalDays / allItems.length);
  }

  calculateReliabilityScore(prs, mergedPRs, avgTimeToClose) {
    if (prs.length === 0) return 50;
    
    const mergeRate = (mergedPRs.length / prs.length) * 100;
    const timeScore = Math.max(0, 100 - avgTimeToClose * 2);
    
    return Math.round((mergeRate + timeScore) / 2);
  }

  determineActivityPattern(events, commits) {
    const recentActivity = events.filter(event => {
      const eventDate = new Date(event.created_at);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return eventDate > weekAgo;
    }).length;
    
    if (recentActivity > 10) return 'high';
    if (recentActivity > 3) return 'medium';
    return 'low';
  }

  isUserActive(lastActivity) {
    const daysSince = (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince < 3;
  }

  isStaleIssue(issue, daysThreshold = 7) {
    if (!issue.assignee && issue.assignees.length === 0) return false;
    if (issue.state === 'closed') return false;
    if (issue.pull_request) return false;

    const lastUpdate = new Date(issue.updated_at);
    const daysSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
    
    return daysSinceUpdate > daysThreshold;
  }

  parseRepoUrl(input) {
    const urlMatch = input.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (urlMatch) {
      return { owner: urlMatch[1], repo: urlMatch[2].replace(/\.git$/, '') };
    }

    const directMatch = input.match(/^([^\/]+)\/([^\/]+)$/);
    if (directMatch) {
      return { owner: directMatch[1], repo: directMatch[2] };
    }

    return null;
  }
}

export const githubAPI = new GitHubAPI();
