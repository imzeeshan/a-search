import { createClient } from '../../../utils/supabase/server';
import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer';

// Pagination defaults
const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_PAGE = 1;

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

async function searchPBS(query: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const response = await fetch(
      'https://www.pbslearningmedia.org/api/v2/search/?rank_by=recency&q='+query+'&start=0&facet_by=accessibility,additional_features,cp,cs,ct,grades,subject,language,media_type,duration'
    );
    const data = await response.json();

    const transformedResults = data.objects.map((item: any) => {
      let contentType = 'Article';
      if (item.media_type?.[0]?.toLowerCase().includes('video')) {
        contentType = 'Video';
      } else if (item.media_type?.[0]?.toLowerCase().includes('interactive')) {
        contentType = 'Interactive Lesson';
      } else if (item.media_type?.[0]?.toLowerCase().includes('quiz')) {
        contentType = 'Quiz';
      }

      return {
        title: item.title,
        description: item.description?.replace(/(<([^>]+)>)/gi, '') || '',
        image_url: item.poster_images?.[0]?.url || '',
        link: item.canonical_url,
        type: contentType,
        source: 'PBLearning',
        user_id: user.id
      };
    });

    const storedResults = [];
    for (const result of transformedResults) {
      const { data, error } = await supabase
        .from('search_results')
        .select('*')
        .eq('title', result.title)
        .eq('source', result.source)
        .eq('user_id', result.user_id)
        .single();

      if (!data) {
        const { data: insertedData, error: insertError } = await supabase
          .from('search_results')
          .insert([result])
          .select()
          .single();

        if (insertError) {
          console.error('Insert error:', insertError);
          continue;
        }

        if (insertedData) {
          storedResults.push(insertedData);
        }
      } else {
        storedResults.push(data);
      }
    }

    return storedResults.map(result => ({
      id: result.id,
      title: result.title,
      description: result.description || '',
      image: result.image_url || '',
      type: result.type,
      source: result.source,
      url: result.link,
      created_at: result.created_at
    }));
  } catch (error) {
    console.error('PBS search error:', error);
    return [];
  }
}

async function searchKhanAcademy(query: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const browser = await puppeteer.launch({headless: true});
    const page = await browser.newPage();
    await page.goto('https://www.khanacademy.org/search?search_again=1&page_search_query='+query);
   
    await page.waitForSelector('#indexed-search-results');
    await page.waitForNetworkIdle();

    const results = await page.evaluate(() => {
      try {
        const resultsContainer = document.querySelector('#indexed-search-results');
        if (!resultsContainer) {
          console.error('Results container not found');
          return [];
        }

        const items = Array.from(document.querySelectorAll('#indexed-search-results > div._xu2jcg > ul > li'));
        if (items.length === 0) {
          console.warn('No search results found');
          return [];
        }

        return items.map(item => {
          try {
            return {
              title: item.querySelector('div > a > div > div._pxfwtyj > div._2dibcm7')?.textContent?.trim() || '',
              description: item.querySelector('div > a > div > div._pxfwtyj > span')?.textContent?.trim() || '',
              image_url: item.querySelector('.thumbnail img')?.getAttribute('src') || '',
              link: item.querySelector('a')?.href || '',
              type: item.querySelector('.type')?.textContent?.trim() || 'Article',
            };
          } catch (itemError) {
            console.error('Error processing item:', itemError);
            return null;
          }
        }).filter(Boolean);
      } catch (error) {
        console.error('Evaluation error:', error);
        return [];
      }
    });

    await browser.close();

    const transformedResults = results.map(item => item ? ({
      title: item.title || '',
      description: item.description || '',
      image_url: item.image_url || '',
      link: item.link || '',
      type: item.type || 'Article',
      source: 'Khan Academy',
      user_id: user.id
    }) : null).filter(Boolean) as any[];

    const storedResults = [];
    for (const result of transformedResults) {
      const { data: existingData } = await supabase
        .from('search_results')
        .select('*')
        .eq('title', result.title)
        .eq('source', result.source)
        .eq('user_id', result.user_id)
        .single();

      if (!existingData) {
        const { data: insertedData, error: insertError } = await supabase
          .from('search_results')
          .insert([result])
          .select()
          .single();

        if (insertError) {
          console.error('Insert error:', insertError);
          continue;
        }

        if (insertedData) {
          storedResults.push(insertedData);
        }
      } else {
        storedResults.push(existingData);
      }
    }

    return storedResults.map(result => ({
      id: result.id,
      title: result.title,
      description: result.description || '',
      image: result.image_url || '',
      type: result.type,
      source: result.source,
      url: result.link,
      created_at: result.created_at
    }));
  } catch (error) {
    console.error('Khan Academy search error:', error);
    return [];
  }
}

async function searchCK12(query: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const response = await fetch(
      'https://api-prod.ck12.org/flx/search/direct/modality?q='+query+'&pageNum=1&specialSearch=false&filters=false&ck12only=true&pageSize=10&includeEIDs=1&includeSpecialMatches=true&expirationAge=hourly'
    );
    const data = await response.json();

    const results = data?.response?.Artifacts?.result;
    
    if (!results || !Array.isArray(results)) {
      console.error('Invalid CK12 API response format:', data);
      return [];
    }

    const transformedResults = Array.isArray(results) ? results.filter(item => item && item.title).map((item: any) => {
      let contentType = 'Article';
      
      if (item.artifactType === 'lesson') {
        contentType = 'Interactive Lesson';
      } else if (item.artifactType === 'video' || (item.coverImage && item.coverImage.includes('video'))) {
        contentType = 'Video';
      } else if (item.artifactType === 'quiz' || item.artifactType === 'assessment') {
        contentType = 'Quiz';
      } else if (item.artifactType === 'worksheet') {
        contentType = 'Worksheet';
      }

      const description = item.summary || 
        (item.domain?.branchInfo ? `${item.domain.branchInfo.name} - ${item.title}` : '') || 
        '';

      const url = item.handle ? 
        `https://www.ck12.org/${item.handle}` : 
        'https://www.ck12.org';

      return {
        title: item.title || '',
        description: description,
        image_url: item.coverImage || 'https://placehold.co/400x300?text=No+Image',
        link: url,
        type: contentType,
        source: 'CK12',
        user_id: user.id
      };
    }) : [];

    const storedResults = [];
    if (Array.isArray(transformedResults)) {
      for (const result of transformedResults) {
        if (!result || !result.title || !result.source || !result.user_id) {
          console.error('Invalid result data:', result);
          continue;
        }

        try {
          const { data: existingData } = await supabase
            .from('search_results')
            .select('*')
            .eq('title', result.title)
            .eq('source', result.source)
            .eq('user_id', result.user_id)
            .single();

          if (!existingData) {
            const { data: insertedData, error: insertError } = await supabase
              .from('search_results')
              .insert([result])
              .select()
              .single();

            if (insertError) {
              console.error('Insert error:', insertError);
              continue;
            }

            if (insertedData) {
              storedResults.push(insertedData);
            }
          } else {
            storedResults.push(existingData);
          }
        } catch (error) {
          console.error('Error processing result:', error);
          continue;
        }
      }
    }

    return storedResults.map(result => ({
      id: result.id,
      title: result.title,
      description: result.description || '',
      image: result.image_url || '',
      type: result.type,
      source: result.source,
      url: result.link,
      created_at: result.created_at
    }));
  } catch (error) {
    console.error('CK12 search error:', error);
    return [];
  }
}

export async function POST(request: Request) {
  try {
    const { searchQuery, page = DEFAULT_PAGE, pageSize = DEFAULT_PAGE_SIZE } = await request.json();
    if (!searchQuery) {
      return new Response(JSON.stringify({ error: 'Search query is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Ensure page and pageSize are numbers
    const currentPage = Number(page);
    const itemsPerPage = Number(pageSize);

    // Execute searches in parallel but don't wait for completion
    const [pbsResults, ck12Results] = await Promise.all([
      searchPBS(searchQuery).catch(err => {
        console.error('PBS search error:', err);
        return [];
      }),
      searchCK12(searchQuery).catch(err => {
        console.error('CK12 search error:', err);
        return [];
      }),
      // searchKhanAcademy(searchQuery).catch(err => {
      //   console.error('Khan Academy search error:', err);
      //   return [];
      // })
    ]);

    // Store the results asynchronously without waiting
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Store results in background without waiting
      Promise.all([
        storeResults(pbsResults, user.id, supabase),
        storeResults(ck12Results, user.id, supabase),
        // storeResults(khanResults, user.id, supabase)
      ]).catch(err => console.error('Error storing results:', err));
    }

    // Return results immediately with pagination
    // const allResults = [...pbsResults, ...ck12Results, ...khanResults];
    const allResults = [...pbsResults, ...ck12Results];
    
    // Calculate pagination metadata
    const totalItems = allResults.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
    
    // Get the current page of results
    const paginatedResults = allResults.slice(startIndex, endIndex);

    return new Response(JSON.stringify({
      results: paginatedResults,
      pagination: {
        currentPage,
        totalPages,
        pageSize: itemsPerPage,
        totalItems,
        hasNextPage: currentPage < totalPages,
        hasPreviousPage: currentPage > 1
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Search error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function storeResults(results: any[], userId: string, supabase: any) {
  for (const result of results) {
    try {
      const { data: existingData } = await supabase
        .from('search_results')
        .select('*')
        .eq('title', result.title)
        .eq('source', result.source)
        .eq('user_id', userId)
        .single();

      if (!existingData) {
        await supabase
          .from('search_results')
          .insert([{
            ...result,
            user_id: userId
          }]);
      }
    } catch (error) {
      console.error('Error storing result:', error);
    }
  }
}