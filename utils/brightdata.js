// BrightData Reddit crawler for location-based news
// Using built-in fetch (Node.js 18+)

// Location-to-subreddit mapping for Canadian cities and regions
const LOCATION_SUBREDDITS = {
  'ottawa': ['ottawa'],
  'toronto': ['toronto'],
  'montreal': ['montreal'],
  'vancouver': ['vancouver'],
  'calgary': ['Calgary'],
  'edmonton': ['Edmonton'],
  'winnipeg': ['Winnipeg'],
  'halifax': ['halifax'],
  'saskatoon': ['saskatoon'],
  'regina': ['regina'],
  'london': ['londonontario'],
  'kitchener': ['kitchener'],
  'hamilton': ['Hamilton'],
  'windsor': ['windsorontario'],
  'barrie': ['barrie'],
  'kingston': ['KingstonOntario'],
  'atlantic': ['Maritime'],
  'northern-ontario': ['ontario'],
  'british-columbia': ['britishcolumbia']
};

// BrightData API configuration
const BRIGHTDATA_API_URL = 'https://api.brightdata.com/datasets/v3/trigger';
const DATASET_ID = 'gd_lvz8ah06191smkebj4'; // Reddit dataset ID

/**
 * Initialize BrightData client with API key validation
 */
function validateBrightDataConfig() {
  if (!process.env.BRIGHT_DATA_KEY) {
    throw new Error('BRIGHT_DATA_KEY environment variable is required');
  }
  return true;
}

/**
 * Crawl Reddit subreddits for news content related to a specific location
 * @param {string} location - The location to crawl (e.g., 'ottawa', 'toronto')
 * @param {string} query - Optional query to focus the search
 * @returns {Promise<Object>} Crawled news content and metadata
 */
async function crawlRedditNews(location, query = '') {
  try {
    console.log(`🔍 Starting BrightData Reddit crawl for location: ${location}`);
    
    // Validate configuration
    validateBrightDataConfig();
    
    // Get subreddits for the location
    const subreddits = LOCATION_SUBREDDITS[location.toLowerCase()];
    if (!subreddits || subreddits.length === 0) {
      throw new Error(`No subreddits configured for location: ${location}`);
    }
    
    console.log(`📋 Using subreddits for ${location}:`, subreddits);
    
    // Build requests for each subreddit - optimized for speed
    const requests = subreddits.map(subreddit => ({
      url: `https://www.reddit.com/r/${subreddit}`,
      sort_by: 'Hot', // Get hot posts for current relevance
      sort_by_time: 'Today', // Focus on today's posts
      num_of_posts: 2, // Reduced to 1 for faster processing
    }));
    
    console.log(`🚀 Triggering BrightData crawl for ${requests.length} subreddits`);
    
    // Make the API request
    const response = await fetch(`${BRIGHTDATA_API_URL}?dataset_id=${DATASET_ID}&include_errors=true&type=discover_new&discover_by=subreddit_url`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.BRIGHT_DATA_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requests)
    });
    
    if (!response.ok) {
      throw new Error(`BrightData API error: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log(`✅ BrightData crawl initiated. Snapshot ID: ${result.snapshot_id}`);
    
    // Wait for the crawl to complete and get results
    const crawlResults = await waitForCrawlCompletion(result.snapshot_id);
    
    // Process the results into news articles
    const processedArticles = processRedditResults(crawlResults, location, query);
    
    return {
      success: true,
      location: location,
      query: query,
      snapshotId: result.snapshot_id,
      subreddits: subreddits,
      resultsCount: crawlResults.length,
      articles: processedArticles,
      crawlTime: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`❌ Error crawling Reddit news for ${location}:`, error);
    
    return {
      success: false,
      location: location,
      error: error.message,
      articles: [],
      crawlTime: new Date().toISOString()
    };
  }
}

/**
 * Wait for BrightData crawl to complete and retrieve results
 * @param {string} snapshotId - The snapshot ID from the crawl request
 * @returns {Promise<Array>} Crawl results
 */
async function waitForCrawlCompletion(snapshotId) {
  const maxWaitTime = 45000; // 45 seconds max wait (reduced for speed)
  const pollInterval = 3000; // Check every 3 seconds (faster polling)
  const startTime = Date.now();
  
  console.log(`⏳ Waiting for crawl completion (Snapshot ID: ${snapshotId})`);
  
  while (Date.now() - startTime < maxWaitTime) {
    try {
      const response = await fetch(`https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}`, {
        headers: {
          'Authorization': `Bearer ${process.env.BRIGHT_DATA_KEY}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to check snapshot status: ${response.status}`);
      }
      
      let snapshot;
      const responseText = await response.text();
      try {
        console.log(`📋 Raw response length: ${responseText.length} chars`);
        console.log(`📋 Raw response (first 500 chars): ${responseText.substring(0, 500)}...`);
        
        // Try to find the JSON part if there's extra content
        let jsonText = responseText.trim();
        
        // Check if we got data directly (indicated by post_id field)
        if (jsonText.includes('"post_id"')) {
          console.log(`✅ Got data directly - processing results`);
          
          // Parse the response as JSON lines (multiple JSON objects)
          const lines = jsonText.split('\n').filter(line => line.trim());
          const allPosts = [];
          
          for (const line of lines) {
            try {
              const post = JSON.parse(line.trim());
              if (post.post_id) {
                allPosts.push(post);
              }
            } catch (e) {
              // Skip invalid lines
            }
          }
          
          console.log(`📊 Found ${allPosts.length} Reddit posts`);
          return allPosts;
        }

        // Handle various JSON parsing issues for status responses
        try {
          // First try parsing as-is
          snapshot = JSON.parse(jsonText);
        } catch (firstError) {
          // If that fails, try to extract clean JSON
          if (jsonText.includes('}{')) {
            // Multiple JSON objects - take the first one
            const firstBrace = jsonText.indexOf('{');
            const lastBrace = jsonText.indexOf('}') + 1;
            jsonText = jsonText.substring(firstBrace, lastBrace);
            console.log(`📋 Extracted JSON from multiple objects: ${jsonText.substring(0, 200)}...`);
          } else {
            // Try to find the end of valid JSON by counting braces
            let braceCount = 0;
            let endPos = 0;
            for (let i = 0; i < jsonText.length; i++) {
              if (jsonText[i] === '{') braceCount++;
              if (jsonText[i] === '}') braceCount--;
              if (braceCount === 0 && jsonText[i] === '}') {
                endPos = i + 1;
                break;
              }
            }
            if (endPos > 0) {
              jsonText = jsonText.substring(0, endPos);
              console.log(`📋 Extracted JSON by brace counting: ${jsonText.substring(0, 200)}...`);
            }
          }
          
          try {
            snapshot = JSON.parse(jsonText);
          } catch (secondError) {
            console.error(`❌ Second JSON parse attempt failed:`, secondError.message);
            throw new Error(`Invalid JSON response from BrightData API: ${secondError.message}`);
          }
        }
      } catch (parseError) {
        console.error(`❌ Failed to parse JSON response:`, parseError.message);
        console.error(`❌ Full response text: ${responseText}`);
        throw new Error(`Invalid JSON response from BrightData API: ${parseError.message}`);
      }
      
      if (snapshot.status === 'completed') {
        console.log(`✅ Crawl completed. Found ${snapshot.total_rows} results`);
        
        // Get the actual data
        const dataResponse = await fetch(`https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}/data`, {
          headers: {
            'Authorization': `Bearer ${process.env.BRIGHT_DATA_KEY}`
          }
        });
        
        if (!dataResponse.ok) {
          throw new Error(`Failed to fetch crawl data: ${dataResponse.status}`);
        }
        
        let data;
        const dataText = await dataResponse.text();
        console.log(`📋 Raw data response length: ${dataText.length} chars`);
        console.log(`📋 Raw data response (first 500 chars): ${dataText.substring(0, 500)}...`);
        
        try {
          // Try to clean up the JSON if needed
          let cleanDataText = dataText.trim();
          
          // Handle multiple JSON objects or trailing content
          if (cleanDataText.includes('}{')) {
            console.log(`⚠️ Multiple JSON objects detected, attempting to parse as JSON lines`);
            // Split by lines and parse each JSON object
            const lines = cleanDataText.split('\n').filter(line => line.trim());
            data = lines.map(line => JSON.parse(line.trim()));
          } else if (cleanDataText.startsWith('[') && cleanDataText.includes('}]')) {
            // Looks like an array of JSON objects - try to parse as array
            try {
              data = JSON.parse(cleanDataText);
            } catch (arrayError) {
              // If array parsing fails, try to extract just the array part
              const arrayStart = cleanDataText.indexOf('[');
              const arrayEnd = cleanDataText.lastIndexOf(']') + 1;
              if (arrayStart >= 0 && arrayEnd > arrayStart) {
                const arrayText = cleanDataText.substring(arrayStart, arrayEnd);
                console.log(`📋 Extracted array JSON: ${arrayText.substring(0, 200)}...`);
                data = JSON.parse(arrayText);
              } else {
                throw arrayError;
              }
            }
          } else {
            // Single JSON object or unknown format
            data = JSON.parse(cleanDataText);
          }
        } catch (parseError) {
          console.error(`❌ Failed to parse data JSON response:`, parseError.message);
          console.error(`❌ Data response sample: ${dataText.substring(0, 1000)}...`);
          
          // Last resort: try to extract JSON objects manually
          try {
            const jsonObjects = [];
            let currentPos = 0;
            
            while (currentPos < dataText.length) {
              const nextBrace = dataText.indexOf('{', currentPos);
              if (nextBrace === -1) break;
              
              let braceCount = 0;
              let endPos = nextBrace;
              
              for (let i = nextBrace; i < dataText.length; i++) {
                if (dataText[i] === '{') braceCount++;
                if (dataText[i] === '}') braceCount--;
                if (braceCount === 0) {
                  endPos = i + 1;
                  break;
                }
              }
              
              if (braceCount === 0) {
                const objText = dataText.substring(nextBrace, endPos);
                try {
                  const obj = JSON.parse(objText);
                  jsonObjects.push(obj);
                } catch (objError) {
                  console.warn(`⚠️ Failed to parse extracted object: ${objError.message}`);
                }
              }
              
              currentPos = endPos;
            }
            
            if (jsonObjects.length > 0) {
              console.log(`📋 Manually extracted ${jsonObjects.length} JSON objects`);
              data = jsonObjects;
            } else {
              throw new Error(`Could not extract any valid JSON objects from response`);
            }
          } catch (extractError) {
            throw new Error(`Invalid JSON data response from BrightData API: ${parseError.message}`);
          }
        }
        
        return data;
      }
      
      if (snapshot.status === 'failed') {
        throw new Error(`Crawl failed: ${snapshot.error || 'Unknown error'}`);
      }
      
      console.log(`⏳ Crawl status: ${snapshot.status}. Waiting...`);
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      
    } catch (error) {
      console.error(`❌ Error checking crawl status:`, error);
      throw error;
    }
  }
  
  throw new Error('Crawl timeout: Results not ready within 60 seconds');
}

/**
 * Process Reddit crawl results into structured news articles
 * @param {Array} results - Raw results from BrightData Reddit crawl
 * @param {string} location - The location being crawled
 * @param {string} query - Optional query filter
 * @returns {Array} Processed news articles
 */
function processRedditResults(results, location, query = '') {
  if (!results || !Array.isArray(results)) {
    console.log('⚠️ No results to process');
    return [];
  }
  
  console.log(`🔧 Processing ${results.length} Reddit results for ${location}`);
  
  return results
    .filter(post => {
      // Filter for news-relevant posts - use actual field names from BrightData
      if (!post.title) return false;
      
      // Enhanced news relevance filtering
      const title = post.title.toLowerCase();
      const content = (post.description || '').toLowerCase();
      const searchText = `${title} ${content}`;
      
      // Skip obviously non-news content
      const skipPatterns = [
        'weekly thread', 'daily thread', 'monthly thread', 'megathread',
        'looking for', 'where to', 'recommendations', 'help me find',
        'eli5', 'explain like', 'shower thought', 'unpopular opinion',
        'am i the only one', 'does anyone else', 'dae '
      ];
      
      if (skipPatterns.some(pattern => title.includes(pattern))) {
        return false;
      }
      
      // Prioritize news-like content
      const newsIndicators = [
        'breaking', 'news', 'report', 'announced', 'confirmed', 'update',
        'developing', 'just in', 'alert', 'statement', 'press release',
        'government', 'council', 'mayor', 'minister', 'official',
        'police', 'fire', 'emergency', 'accident', 'incident',
        'budget', 'funding', 'investment', 'project', 'construction',
        'election', 'vote', 'policy', 'law', 'bill', 'regulation'
      ];
      
      const hasNewsIndicator = newsIndicators.some(indicator => 
        title.includes(indicator) || content.includes(indicator)
      );
      
      // If query is provided, filter by relevance
      if (query && query.trim() !== '') {
        const queryLower = query.toLowerCase();
        const queryWords = queryLower.split(/\s+/).filter(word => word.length > 2);
        const hasMatch = queryWords.some(word => searchText.includes(word));
        if (!hasMatch && !hasNewsIndicator) return false;
      }
      
      // Filter out low-quality posts
      const upvotes = parseInt(post.num_upvotes) || 0;
      const comments = post.num_comments || 0;
      
      // More selective filtering for news content
      if (upvotes < 2) return false;
      if (hasNewsIndicator && upvotes < 5) return false; // Higher bar for news content
      
      return true;
    })
    .map((post, index) => {
      // Extract only essential data for news segments
      const title = post.title || 'Reddit Post';
      const content = post.description || '';
      const subreddit = post.community_name || 'unknown';
      const upvotes = parseInt(post.num_upvotes) || 0;
      const comments = post.num_comments || 0;
      const postDate = post.date_posted;
      
      // Process top 5 comments for additional context
      const topComments = processTopComments(post.comments || []);
      
      // Calculate relevance score
      const relevanceScore = calculateRelevanceScore({
        title,
        content,
        upvotes,
        comments,
        date_posted: postDate
      }, location, query);
      
      // Clean and truncate content for LLM processing (shorter for news segments)
      const cleanContent = content
        .replace(/\n+/g, ' ') // Replace line breaks with spaces
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim()
        .substring(0, 500); // Reduced from 1000 to 500 for faster processing
      
      return {
        headline: title,
        content: cleanContent,
        url: post.url,
        source: `r/${subreddit}`,
        score: upvotes,
        numComments: comments,
        publishDate: postDate ? new Date(postDate).toISOString() : null,
        relevanceScore: relevanceScore,
        topComments: topComments
      };
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore) // Sort by relevance
    .slice(0, 8); // Reduced to 8 for faster processing and focused news segments
}

/**
 * Process top comments from a Reddit post for additional context
 * @param {Array} comments - Array of comment objects from Reddit post
 * @returns {Array} Top 5 processed comments
 */
function processTopComments(comments) {
  if (!comments || !Array.isArray(comments) || comments.length === 0) {
    return [];
  }
  
  // Filter out deleted/null comments and sort by upvotes
  const validComments = comments
    .filter(comment => comment.comment && comment.comment.trim() !== '' && comment.comment !== null)
    .sort((a, b) => (parseInt(b.num_upvotes) || 0) - (parseInt(a.num_upvotes) || 0))
    .slice(0, 5); // Take top 5 comments
  
  return validComments.map(comment => {
    // Clean and truncate comment text
    const cleanComment = (comment.comment || '')
      .replace(/\n+/g, ' ') // Replace line breaks with spaces
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .substring(0, 300); // Limit to 300 characters to keep context manageable
    
    return {
      text: cleanComment,
      upvotes: parseInt(comment.num_upvotes) || 0,
      author: comment.user_commenting || 'unknown',
      timeAgo: comment.date_of_comment ? getTimeAgo(new Date(comment.date_of_comment)) : 'unknown',
      repliesCount: comment.num_replies || 0
    };
  });
}

/**
 * Calculate relevance score for a Reddit post
 * @param {Object} post - Processed Reddit post data
 * @param {string} location - Target location
 * @param {string} query - Search query
 * @returns {number} Relevance score
 */
function calculateRelevanceScore(post, location, query) {
  let score = 0;
  
  // Base score from Reddit metrics
  const upvotes = post.upvotes || 0;
  const comments = post.comments || 0;
  
  score += Math.log(upvotes + 1) * 3; // Upvotes (logarithmic scale, increased weight)
  score += Math.log(comments + 1) * 2; // Comments
  
  // Engagement ratio bonus
  if (upvotes > 0) {
    const engagementRatio = comments / upvotes;
    if (engagementRatio > 0.1) score += 5; // High engagement posts
  }
  
  // Recency bonus (newer posts get higher score)
  if (post.date_posted) {
    const postDate = new Date(post.date_posted);
    const hoursAgo = (Date.now() - postDate.getTime()) / (1000 * 60 * 60);
    
    if (hoursAgo < 24) score += 8; // Bonus for posts within 24 hours
    if (hoursAgo < 6) score += 12; // Extra bonus for very recent posts
    if (hoursAgo < 1) score += 15; // Maximum bonus for posts within 1 hour
  }
  
  // Location relevance
  const titleLower = (post.title || '').toLowerCase();
  const contentLower = (post.content || '').toLowerCase();
  const locationLower = location.toLowerCase();
  
  // Enhanced location matching
  if (titleLower.includes(locationLower)) score += 20; // Increased weight for title
  if (contentLower.includes(locationLower)) score += 12; // Increased weight for content
  
  // Check for location variations (e.g., "ottawa" vs "ottawa-gatineau")
  const locationVariations = getLocationVariations(location);
  for (const variation of locationVariations) {
    if (titleLower.includes(variation)) score += 15;
    if (contentLower.includes(variation)) score += 8;
  }
  
  // Query relevance
  if (query) {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(' ').filter(word => word.length > 2);
    
    for (const word of queryWords) {
      if (titleLower.includes(word)) score += 25; // High weight for query in title
      if (contentLower.includes(word)) score += 18; // High weight for query in content
    }
  }
  
  // Enhanced news relevance scoring
  const breakingNewsKeywords = [
    'breaking', 'urgent', 'alert', 'just in', 'developing', 'live'
  ];
  
  const newsKeywords = [
    'news', 'report', 'announced', 'confirmed', 'update', 'statement',
    'press release', 'official', 'government', 'council', 'mayor',
    'minister', 'police', 'fire', 'emergency', 'budget', 'funding',
    'election', 'vote', 'policy', 'law', 'bill', 'regulation'
  ];
  
  const localNewsKeywords = [
    'city', 'downtown', 'local', 'community', 'neighborhood', 'residents',
    'construction', 'project', 'development', 'infrastructure', 'transit',
    'school', 'hospital', 'park', 'road', 'bridge'
  ];
  
  // Breaking news gets highest priority
  for (const keyword of breakingNewsKeywords) {
    if (titleLower.includes(keyword)) score += 35;
    if (contentLower.includes(keyword)) score += 20;
  }
  
  // Regular news content
  for (const keyword of newsKeywords) {
    if (titleLower.includes(keyword)) score += 25;
    if (contentLower.includes(keyword)) score += 15;
  }
  
  // Local news relevance
  for (const keyword of localNewsKeywords) {
    if (titleLower.includes(keyword)) score += 20;
    if (contentLower.includes(keyword)) score += 12;
  }
  
  // Content quality bonus
  const wordCount = (post.content || '').split(' ').length;
  if (wordCount > 50) score += 5; // Bonus for substantial content
  if (wordCount > 200) score += 8; // Extra bonus for detailed posts
  
  // Community size factor (larger communities might have more relevant discussions)
  if (post.communityMembers) {
    if (post.communityMembers > 50000) score += 3;
    if (post.communityMembers > 100000) score += 5;
  }
  
  return Math.round(score);
}

/**
 * Get location variations for better matching
 * @param {string} location - Base location
 * @returns {Array} Array of location variations
 */
function getLocationVariations(location) {
  const variations = [];
  const locationLower = location.toLowerCase();
  
  // Add common variations
  variations.push(locationLower);
  
  // Add specific variations for major Canadian cities
  const cityVariations = {
    'ottawa': ['ottawa-gatineau', 'ncr', 'national capital region', 'bytown'],
    'toronto': ['gta', 'greater toronto area', 'the 6ix', 'hogtown'],
    'montreal': ['mtl', 'ville-marie', 'québec'],
    'vancouver': ['van', 'vancity', 'lower mainland', 'metro vancouver'],
    'calgary': ['yyc', 'cowtown'],
    'edmonton': ['yeg', 'e-town'],
    'winnipeg': ['wpg', 'the peg'],
    'halifax': ['hfx', 'haligonia']
  };
  
  if (cityVariations[locationLower]) {
    variations.push(...cityVariations[locationLower]);
  }
  
  return variations;
}

/**
 * Generate news context from Reddit articles for AI consumption
 * @param {Array} articles - Processed Reddit articles
 * @param {string} location - The location(s)
 * @returns {string} News summary for AI context
 */
function generateNewsContext(articles, location) {
  if (!articles || articles.length === 0) {
    return `No current community discussions found for ${location}. You may want to discuss general topics or ask the user for more specific interests.`;
  }
  
  // Sort articles by relevance score (highest first)
  const sortedArticles = articles.sort((a, b) => b.relevanceScore - a.relevanceScore);
  
  // Group articles by topic/theme for better coherence
  const topArticles = sortedArticles.slice(0, 5); // Focus on top 5 most relevant
  
  // Create coherent news segments
  const newsSegments = topArticles.map((article, index) => {
    const timeAgo = article.publishDate ? getTimeAgo(new Date(article.publishDate)) : 'recently';
    
    // Extract key topics and sentiment
    const engagement = article.score + article.numComments;
    const engagementLevel = engagement > 50 ? 'high' : engagement > 20 ? 'moderate' : 'low';
    
    return {
      headline: article.headline,
      content: article.content,
      source: article.source,
      timeAgo: timeAgo,
      engagement: engagement,
      engagementLevel: engagementLevel,
      relevanceScore: article.relevanceScore,
      topComments: article.topComments || []
    };
  });
  
  // Create a coherent narrative for news anchor
  const topStory = newsSegments[0];
  const otherStories = newsSegments.slice(1);
  
  let newsScript = `**BREAKING NEWS CONTEXT FOR ${location.toUpperCase()}:**\n\n`;
  
  // Lead story
  newsScript += `**TOP STORY:** ${topStory.headline}\n`;
  newsScript += `Community Discussion: ${topStory.content}\n`;
  newsScript += `Source: ${topStory.source} | Posted: ${topStory.timeAgo} | Community Engagement: ${topStory.engagementLevel}\n`;
  
  // Add top comments for context
  if (topStory.topComments && topStory.topComments.length > 0) {
    newsScript += `**Community Reactions:**\n`;
    topStory.topComments.slice(0, 3).forEach((comment, idx) => {
      newsScript += `   • "${comment.text}" (${comment.upvotes} upvotes, ${comment.timeAgo})\n`;
    });
  }
  newsScript += `\n`;
  
  // Additional stories
  if (otherStories.length > 0) {
    newsScript += `**OTHER DEVELOPING STORIES:**\n`;
    otherStories.forEach((story, index) => {
      newsScript += `${index + 2}. ${story.headline}\n`;
      if (story.content) {
        newsScript += `   Community says: ${story.content.substring(0, 200)}${story.content.length > 200 ? '...' : ''}\n`;
      }
      newsScript += `   Source: ${story.source} | ${story.timeAgo}\n`;
      
      // Add top comment for additional context
      if (story.topComments && story.topComments.length > 0) {
        const topComment = story.topComments[0];
        newsScript += `   Top reaction: "${topComment.text.substring(0, 150)}${topComment.text.length > 150 ? '...' : ''}" (${topComment.upvotes} upvotes)\n`;
      }
      newsScript += `\n`;
    });
  }
  
  // Add context for news anchor persona
  newsScript += `**NEWS ANCHOR GUIDANCE:**\n`;
  newsScript += `- These are current community discussions from Reddit, not traditional news sources\n`;
  newsScript += `- Present information conversationally, acknowledging it's from community discussions\n`;
  newsScript += `- Focus on community sentiment and local perspectives\n`;
  newsScript += `- Use phrases like "the community is discussing...", "locals are talking about...", "people are saying..."\n`;
  newsScript += `- Include community reactions and comments to show public sentiment\n`;
  newsScript += `- Reference specific community feedback when relevant (e.g., "One resident commented...", "The community is responding...")\n`;
  newsScript += `- ${topStory.engagementLevel === 'high' ? 'The top story has significant community interest' : 'These are emerging community conversations'}\n`;
  
  return newsScript;
}

/**
 * Helper function to get human-readable time ago
 * @param {Date} date - The date to compare
 * @returns {string} Human-readable time ago
 */
function getTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffHours < 1) return 'Less than 1 hour ago';
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return date.toLocaleDateString();
}

/**
 * Get list of supported locations
 * @returns {Array} Array of supported location strings
 */
function getSupportedLocations() {
  return Object.keys(LOCATION_SUBREDDITS);
}

/**
 * Validate if a location is supported
 * @param {string} location - Location to validate
 * @returns {boolean} True if location is supported
 */
function isLocationSupported(location) {
  return Object.hasOwnProperty.call(LOCATION_SUBREDDITS, location.toLowerCase());
}

/**
 * Get subreddits for a specific location
 * @param {string} location - Location to get subreddits for
 * @returns {Array} Array of subreddit names
 */
function getSubredditsForLocation(location) {
  return LOCATION_SUBREDDITS[location.toLowerCase()] || [];
}

module.exports = {
  crawlRedditNews,
  generateNewsContext,
  getSupportedLocations,
  isLocationSupported,
  getSubredditsForLocation,
  processRedditResults,
  calculateRelevanceScore,
  getLocationVariations,
  getTimeAgo
}; 