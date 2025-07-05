// Tavily client will be initialized dynamically
let tavilyClient = null;

// Initialize Tavily client with dynamic import
async function initializeTavilyClient() {
  if (!tavilyClient) {
    const { tavily } = await import('@tavily/core');
    tavilyClient = tavily({
      apiKey: process.env.TAVILY_API_KEY
    });
  }
  return tavilyClient;
}

// Supported Canadian locations for CTV News
const SUPPORTED_LOCATIONS = [
  'ottawa',
  'toronto',
  'montreal',
  'vancouver',
  'calgary',
  'edmonton',
  'winnipeg',
  'halifax',
  'saskatoon',
  'regina',
  'london',
  'kitchener',
  'hamilton',
  'windsor',
  'barrie',
  'kingston',
  'atlantic',
  'northern-ontario',
  'british-columbia'
];

/**
 * Crawl CTV News for a specific location to gather recent news content
 * @param {string} location - The location to crawl (e.g., 'ottawa', 'toronto')
 * @param {string} query - Optional specific query to focus the crawl
 * @returns {Promise<Object>} Crawled news content and metadata
 */
async function crawlCTVNews(location, query = '') {
  try {
    console.log(`🕸️ Starting Tavily crawl for location: ${location}`);
    
    // Validate location
    if (!SUPPORTED_LOCATIONS.includes(location.toLowerCase())) {
      throw new Error(`Unsupported location: ${location}. Supported locations: ${SUPPORTED_LOCATIONS.join(', ')}`);
    }
    
    // Initialize Tavily client
    const client = await initializeTavilyClient();
    
    // Try multiple crawling strategies
    let response = null;
    let crawlError = null;
    
    // Strategy 1: Try crawling the main CTV News location page
    try {
      const baseUrl = `https://www.ctvnews.ca/${location.toLowerCase()}`;
      const instructions = query 
        ? `Find recent news articles about "${query}" from CTV News ${location}. Focus on headlines, article content, dates, and key details.`
        : `Find recent news articles from CTV News ${location}. Focus on headlines, article content, dates, and key details from the latest news stories.`;
      
      console.log(`🔍 Strategy 1: Crawling ${baseUrl} with instructions: ${instructions}`);
      
      response = await client.crawl(baseUrl, {
        instructions: instructions,
        max_results: 10,
        include_domains: ['ctvnews.ca'],
        max_depth: 2
      });
      
      console.log(`✅ Strategy 1 successful. Found ${response.results?.length || 0} results`);
    } catch (error) {
      console.log(`⚠️ Strategy 1 failed: ${error.message}`);
      crawlError = error;
    }
    
    // Strategy 2: If main crawl fails, try a broader search approach
    if (!response || !response.results || response.results.length === 0) {
      try {
        console.log(`🔍 Strategy 2: Using search-based crawling for ${location}`);
        
        const searchQuery = query 
          ? `${query} site:ctvnews.ca/${location}`
          : `news today site:ctvnews.ca/${location}`;
        
        // Use search API which is more reliable than direct crawling
        response = await client.search(searchQuery, {
          search_depth: 'advanced',
          max_results: 10,
          include_domains: ['ctvnews.ca'],
          include_raw_content: true
        });
        
        console.log(`✅ Strategy 2 successful. Found ${response.results?.length || 0} results`);
      } catch (error) {
        console.log(`⚠️ Strategy 2 failed: ${error.message}`);
        crawlError = error;
      }
    }
    
    // Strategy 3: If both fail, try general CTV News search
    if (!response || !response.results || response.results.length === 0) {
      try {
        console.log(`🔍 Strategy 3: General CTV News search for ${location}`);
        
        const generalQuery = query 
          ? `"${query}" "${location}" site:ctvnews.ca`
          : `"${location}" news today site:ctvnews.ca`;
        
        response = await client.search(generalQuery, {
          search_depth: 'basic',
          max_results: 8,
          include_domains: ['ctvnews.ca'],
          include_raw_content: true
        });
        
        console.log(`✅ Strategy 3 successful. Found ${response.results?.length || 0} results`);
      } catch (error) {
        console.log(`⚠️ Strategy 3 failed: ${error.message}`);
        crawlError = error;
      }
    }
    
    // If all strategies failed, throw the last error
    if (!response || !response.results || response.results.length === 0) {
      throw crawlError || new Error('All crawling strategies failed');
    }
    
    console.log(`✅ Tavily crawl completed for ${location}. Found ${response.results?.length || 0} results`);
    
    // Process and structure the results
    const processedResults = processNewsResults(response.results || [], location);
    
    return {
      success: true,
      location: location,
      query: query,
      resultsCount: response.results?.length || 0,
      articles: processedResults,
      crawlTime: new Date().toISOString(),
      rawResponse: response // Keep raw response for debugging
    };
    
  } catch (error) {
    console.error(`❌ Error crawling CTV News for ${location}:`, error);
    
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
 * Process raw crawl results into structured news articles
 * @param {Array} results - Raw results from Tavily crawl
 * @param {string} location - The location being crawled
 * @returns {Array} Processed news articles
 */
function processNewsResults(results, location) {
  return results.map((result, index) => {
    // Use multiple content sources
    const rawContent = result.raw_content || '';
    const regularContent = result.content || '';
    const title = result.title || '';
    
    // Combine content sources for better extraction
    const combinedContent = rawContent || regularContent;
    const lines = combinedContent.split('\n').filter(line => line.trim().length > 0);
    
    // Try to identify headline - prefer title from result, fallback to content extraction
    const headline = title || extractHeadline(lines) || 'News Update';
    
    // Extract article content (remove navigation, ads, etc.)
    const articleContent = extractArticleContent(combinedContent) || regularContent || rawContent.substring(0, 500);
    
    // Try to extract date information
    const publishDate = extractPublishDate(combinedContent);
    
    return {
      id: `${location}-${index}`,
      url: result.url,
      headline: headline,
      content: articleContent,
      publishDate: publishDate,
      location: location,
      source: 'CTV News',
      crawledAt: new Date().toISOString(),
      wordCount: articleContent.split(' ').length,
      favicon: result.favicon,
      score: result.score || 0 // Include relevance score if available
    };
  }).filter(article => 
    article.headline && 
    article.content && 
    article.content.length > 50 && // Reduced from 100 to 50 for less strict filtering
    article.headline !== 'News Update' // Filter out generic headlines
  );
}

/**
 * Extract headline from content lines
 * @param {Array} lines - Content lines
 * @returns {string} Extracted headline
 */
function extractHeadline(lines) {
  // Look for lines that could be headlines
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 10 && trimmed.length < 300 && 
        !trimmed.includes('CTV News') && 
        !trimmed.includes('Navigation') &&
        !trimmed.includes('Search') &&
        !trimmed.includes('Menu') &&
        !trimmed.includes('Skip to') &&
        !trimmed.includes('Copyright') &&
        !trimmed.includes('Privacy') &&
        !trimmed.includes('Terms') &&
        !trimmed.includes('Contact') &&
        !trimmed.startsWith('http') &&
        !trimmed.includes('www.') &&
        !/^\d+$/.test(trimmed)) { // Not just numbers
      return trimmed;
    }
  }
  return null; // Return null instead of generic headline
}

/**
 * Extract clean article content from raw content
 * @param {string} content - Raw content
 * @returns {string} Cleaned article content
 */
function extractArticleContent(content) {
  if (!content) return '';
  
  // Remove common navigation and UI elements
  let cleaned = content
    .replace(/CTV News.*?Navigation/gi, '')
    .replace(/Search.*?Navigation/gi, '')
    .replace(/Menu.*?Navigation/gi, '')
    .replace(/Skip to.*?main content/gi, '')
    .replace(/Copyright.*?CTV/gi, '')
    .replace(/Privacy Policy/gi, '')
    .replace(/Terms of Use/gi, '')
    .replace(/\[.*?\]/g, '') // Remove bracketed content
    .replace(/\n\s*\n/g, '\n') // Remove multiple newlines
    .replace(/^\s+|\s+$/g, ''); // Trim whitespace
  
  // Split into paragraphs and filter out short ones and navigation elements
  const paragraphs = cleaned.split('\n')
    .filter(p => {
      const trimmed = p.trim();
      return trimmed.length > 30 && // Reduced from 50 to 30
             !trimmed.includes('www.') &&
             !trimmed.startsWith('http') &&
             !trimmed.includes('Contact') &&
             !trimmed.includes('Follow') &&
             !trimmed.includes('Subscribe') &&
             !trimmed.includes('Share') &&
             !/^\d+$/.test(trimmed); // Not just numbers
    })
    .slice(0, 15); // Increased from 10 to 15 paragraphs
  
  return paragraphs.join('\n\n');
}

/**
 * Extract publish date from content
 * @param {string} content - Raw content
 * @returns {string|null} Extracted date or null
 */
function extractPublishDate(content) {
  // Look for common date patterns
  const datePatterns = [
    /(\w+\s+\d{1,2},\s+\d{4})/g, // "January 15, 2024"
    /(\d{1,2}\/\d{1,2}\/\d{4})/g, // "01/15/2024"
    /(\d{4}-\d{2}-\d{2})/g // "2024-01-15"
  ];
  
  for (const pattern of datePatterns) {
    const match = content.match(pattern);
    if (match) {
      return match[0];
    }
  }
  
  return null;
}

/**
 * Generate a news summary from crawled articles
 * @param {Array} articles - Processed news articles
 * @param {string} location - The location
 * @returns {string} News summary for AI context
 */
function generateNewsContext(articles, location) {
  if (!articles || articles.length === 0) {
    return `No recent news articles found for ${location}.`;
  }
  
  const context = articles.map((article, index) => {
    return `Article ${index + 1}: ${article.headline}
Location: ${article.location}
Published: ${article.publishDate || 'Recently'}
Content: ${article.content.substring(0, 500)}${article.content.length > 500 ? '...' : ''}
Source: ${article.source}
URL: ${article.url}
---`;
  }).join('\n\n');
  
  return `Recent news from ${location.toUpperCase()}:\n\n${context}`;
}

/**
 * Get list of supported locations
 * @returns {Array} Array of supported location strings
 */
function getSupportedLocations() {
  return [...SUPPORTED_LOCATIONS];
}

/**
 * Validate if a location is supported
 * @param {string} location - Location to validate
 * @returns {boolean} True if location is supported
 */
function isLocationSupported(location) {
  return SUPPORTED_LOCATIONS.includes(location.toLowerCase());
}

module.exports = {
  crawlCTVNews,
  generateNewsContext,
  getSupportedLocations,
  isLocationSupported,
  processNewsResults
}; 