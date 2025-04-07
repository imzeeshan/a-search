import { createClient } from '../../../utils/supabase/server';
import puppeteer from 'puppeteer';

type SearchResult = {
  id: string;
  title: string;
  description: string;
  image: string;
  type: string;
  source: string;
  url: string;
  grade_level?: string;
  created_at: string;
};

async function searchPBS(query: string, user: any): Promise<SearchResult[]> {
  try {
    const response = await fetch(
      'https://www.pbslearningmedia.org/api/v2/search/?rank_by=recency&q='+query+'&start=0&facet_by=accessibility,additional_features,cp,cs,ct,grades,subject,language,media_type,duration'
    );
    const data = await response.json();
    return data.objects || [];
  } catch (error) {
    console.error('PBS search error:', error);
    return [];
  }
}

async function searchKhanAcademy(query: string, user: any): Promise<SearchResult[]> {
  try {
    const browser = await puppeteer.launch({headless: true});
    const page = await browser.newPage();
    await page.goto('https://www.khanacademy.org/search?search_again=1&page_search_query='+query);
   
    await page.waitForSelector('#indexed-search-results');
    await page.waitForNetworkIdle();

    const rawResults = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('#indexed-search-results > div._xu2jcg > ul > li'));
      return items.map(item => ({
        title: item.querySelector('div > a > div > div._pxfwtyj > div._2dibcm7')?.textContent?.trim() || '',
        description: item.querySelector('div > a > div > div._pxfwtyj > div._1sj9gh6')?.textContent?.trim() || '',
        url: (item.querySelector('div > a') as HTMLAnchorElement)?.href || ''
      }));
    });

    await browser.close();

    // Transform raw results into SearchResult type
    return rawResults.map((result, index) => ({
      id: `khan_${Date.now()}_${index}`,
      title: result.title,
      description: result.description,
      image: '', // Khan Academy search results don't typically include images in the search results
      type: 'Video', // Most Khan Academy content is video-based
      source: 'Khan Academy',
      url: result.url,
      created_at: new Date().toISOString()
    }));
  } catch (error) {
    console.error('Khan Academy search error:', error);
    return [];
  }
}

async function searchCK12(query: string, user: any): Promise<SearchResult[]> {
  try {
    const response = await fetch(
      `https://www.ck12.org/api/v1/search/artifacts?q=${query}&page=1&limit=10&type=all`
    );
    const data = await response.json();
    return data?.response?.Artifacts?.result || [];
  } catch (error) {
    console.error('CK12 search error:', error);
    return [];
  }
}

// Listen for messages from the main thread
self.addEventListener('message', async (e: MessageEvent) => {
  const { searchQuery, user } = e.data;
  
  try {
    const [pbsResults, ck12Results, khanResults] = await Promise.all([
      searchPBS(searchQuery, user),
      searchCK12(searchQuery, user),
      searchKhanAcademy(searchQuery, user)
    ]);

    // Send results back to the main thread
    self.postMessage({
      type: 'SEARCH_COMPLETE',
      results: [...pbsResults, ...ck12Results, ...khanResults]
    });
  } catch (error) {
    self.postMessage({
      type: 'SEARCH_ERROR',
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});
