'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

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

type PaginationType = {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};


type SearchState = {
  results: SearchResult[];
  groupedResults?: { source: string; items: SearchResult[]; count: number }[];
  pagination: PaginationType;
  pending?: boolean;
};

// Default pagination values
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;

async function searchPBS(query: string) {
  try {
    const response = await fetch(
      'https://www.pbslearningmedia.org/api/v2/search/?rank_by=recency&q='+query+'&start=0&facet_by=accessibility,additional_features,cp,cs,ct,grades,subject,language,media_type,duration'
    );
    const data = await response.json();

    type PBSMediaItem = {
      media_type?: string[];
      title: string;
      description?: string;
      poster_images?: { url: string }[];
      canonical_url: string;
    };

    type PBSSearchResult = {
      title: string;
      description: string;
      image_url: string;
      link: string;
      type: string;
      source: string;
    };

    return data.objects.map((item: PBSMediaItem) => {
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
        source: 'PBLearning'
      } as PBSSearchResult;
    });
  } catch (error) {
    console.error('PBS search error:', error);
    return [];
  }
}

async function searchCK12(query: string) {
  try {
    const response = await fetch(
      'https://api-prod.ck12.org/flx/search/direct/modality?q='+query+'&pageNum=1&specialSearch=false&filters=false&ck12only=true&pageSize=10&includeEIDs=1&includeSpecialMatches=true&expirationAge=hourly'
    );

    // Check if response is ok
    if (!response.ok) {
      console.error('CK12 API error:', response.status, response.statusText);
      const text = await response.text();
      console.error('Response text:', text);
      return [];
    }

    const data = await response.json();
    const results = data?.response?.Artifacts?.result;
    
    if (!results || !Array.isArray(results)) {
      console.error('Invalid CK12 API response format:', data);
      return [];
    }

    type CK12ArtifactType = 'lesson' | 'video' | 'quiz' | 'assessment' | 'worksheet' | 'article';
    
    type CK12Domain = {
      branchInfo?: {
        name: string;
      };
    };
    
    type CK12Item = {
      artifactType: CK12ArtifactType;
      title: string;
      summary?: string;
      coverImage?: string;
      handle?: string;
      domain?: CK12Domain;
    };
    
    type CK12SearchResult = {
      title: string;
      description: string;
      image_url: string;
      link: string;
      type: string;
      source: string;
    };
    
    const transformedResults = Array.isArray(results) ? results
      .filter((item): item is CK12Item => Boolean(item && item.title))
      .map((item: CK12Item): CK12SearchResult => {
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
          source: 'CK12'
        };
      }) : [];

    return transformedResults;
  } catch (error) {
    console.error('CK12 search error:', error);
    return [];
  }
}

type SupabaseClient = {
  from: (table: string) => {
    select: (columns: string, options?: { count: 'exact' }) => SupabaseQuery;
    insert: (data: DatabaseResult[]) => Promise<{ error: Error | null }>;
  };
};

type SupabaseQuery = {
  eq: (column: string, value: string) => SupabaseQuery;
  or: (conditions: string[]) => SupabaseQuery;
  order: (column: string, options: { ascending: boolean }) => SupabaseQuery;
  range: (from: number, to: number) => Promise<{ data: DatabaseResult[]; error: Error | null }>;
  single: () => Promise<{ data: DatabaseResult | null; error: Error | null }>;
};

type DatabaseResult = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  type: string;
  source: string;
  link: string;
  user_id: string;
  created_at: string;
};

async function getStoredResults(
  supabase: SupabaseClient, 
  userId: string, 
  page: number = 1, 
  pageSize: number = 10, 
  searchQuery?: string
) {
  try {
    let query = supabase
      .from('search_results')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Add search filter if searchQuery is provided
    if (searchQuery?.trim()) {
      // Create a normalized search query
      const normalizedQuery = searchQuery.trim().toLowerCase();
      
      // Use text search with combined conditions
      query = query.or([
        `title.ilike.%${normalizedQuery}%`,
        `description.ilike.%${normalizedQuery}%`
      ]);
    }

    // Get total count first
    const { count } = await query;

    // Then get paginated results with the same filters
    query = supabase
      .from('search_results')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }); // Always order by created_at desc

    // Add search filter if searchQuery is provided
    if (searchQuery?.trim()) {
      const normalizedQuery = searchQuery.trim().toLowerCase();
      
      query = query.or([
        `title.ilike.%${normalizedQuery}%`,
        `description.ilike.%${normalizedQuery}%`
      ]);
    }

    // Add pagination
    const { data, error } = await query
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) {
      console.error('Error fetching stored results:', error);
      return { results: [], totalItems: 0 };
    }

    return {
      results: data.map((result: DatabaseResult) => ({
        id: result.id,
        title: result.title,
        description: result.description || '',
        image: result.image_url || '',
        type: result.type,
        source: result.source,
        url: result.link,
        created_at: result.created_at
      })),
      totalItems: count
    };
  } catch (error) {
    console.error('Error fetching stored results:', error);
    return { results: [], totalItems: 0 };
  }
}

async function storeResults(
  results: Array<{
    title: string;
    description?: string;
    image_url?: string;
    link: string;
    type: string;
    source: string;
  }>, 
  userId: string, 
  supabase: SupabaseClient
) {
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
        const { error } = await supabase
          .from('search_results')
          .insert([{
            ...result,
            user_id: userId,
            id: crypto.randomUUID(),
            created_at: new Date().toISOString()
          }]);
          
        if (error) {
          console.error('Error inserting result:', error);
        }
      }
    } catch (error) {
      console.error('Error storing result:', error);
    }
  }
}

// Group results by source
function groupResultsBySource(results: SearchResult[]) {
  const grouped = results.reduce((acc, result) => {
    const source = result.source;
    if (!acc[source]) {
      acc[source] = [];
    }
    acc[source].push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  return Object.entries(grouped).map(([source, items]) => ({
    source,
    items,
    count: items.length
  }));
}

export async function search(
  prevState: SearchState,
  formData: FormData
): Promise<SearchState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('Not authenticated');
  }

  const searchQuery = formData.get('searchQuery') as string;
  const page = Number(formData.get('page')) || DEFAULT_PAGE;
  const pageSize = Number(formData.get('pageSize')) || DEFAULT_PAGE_SIZE;

  // Only search and store results if there's a non-empty search query
  if (searchQuery?.trim()) {
    const [pbsResults, ck12Results] = await Promise.all([
      searchPBS(searchQuery),
      searchCK12(searchQuery)
    ]);

    // Store results in background
    await storeResults([...pbsResults, ...ck12Results], user.id, supabase);
  }

  // Get paginated results from database (either all results or filtered by search)
  const { results, totalItems } = await getStoredResults(supabase, user.id, page, pageSize, searchQuery);

  // Group results by source if no specific search query
  const groupedResults = !searchQuery?.trim() ? groupResultsBySource(results) : undefined;

  revalidatePath('/search');

  // Return the final state
  return {
    results,
    groupedResults,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalItems / pageSize),
      pageSize,
      totalItems,
      hasNextPage: page < Math.ceil(totalItems / pageSize),
      hasPreviousPage: page > 1
    },
    pending: false
  };
}
