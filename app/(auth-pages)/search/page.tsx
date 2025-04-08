'use client';

import { Search, ChevronDown } from 'lucide-react';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

// Define types for search results
type SearchResultType = {
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

// Define type for grade options
type GradeOptionType = {
  id: number;
  label: string;
  value: string;
};

// Search agent actions
const defaultSearchAgentActions = [
  "Looking through PBSMedia, CK12, and Khan Academy..."
];

// Grade options
const gradeOptions: GradeOptionType[] = [
  { id: 0, label: "All Grades", value: "all" },
  { id: 1, label: "Kindergarten", value: "K" },
  { id: 2, label: "Grade 1", value: "1" },
  { id: 3, label: "Grade 2", value: "2" },
  { id: 4, label: "Grade 3", value: "3" },
  { id: 5, label: "Grade 4", value: "4" },
  { id: 6, label: "Grade 5", value: "5" },
  { id: 7, label: "Grade 6", value: "6" },
  { id: 8, label: "Grade 7", value: "7" },
  { id: 9, label: "Grade 8", value: "8" },
  { id: 10, label: "Grade 9", value: "9" },
  { id: 11, label: "Grade 10", value: "10" },
  { id: 12, label: "Grade 11", value: "11" },
  { id: 13, label: "Grade 12", value: "12" },
];



const SearchResult = ({ title, description, image, type, link }: { title: string; description: string; image: string; type: string; link: string }) => {
  const placeholderImage = "https://picsum.photos/200";
  return (
    <div className="flex border rounded-lg overflow-hidden mb-4 bg-white">
      <div className="w-1/4 min-w-[120px] max-w-[180px] relative">
        <img 
          src={image || placeholderImage}
          alt={title || "Search result image"}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="p-4 flex-1">
        <div className="text-xs text-blue-600 font-medium mb-1">{type}</div>
        <h3 className="font-medium text-lg mb-1">
          <a href={link} target='_blank' rel="noopener noreferrer" className="hover:underline">
            {title}
          </a>
        </h3>
        <div className="text-xs text-gray-500 mb-2">{type} Resource</div>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
    </div>
  );
};

// Pagination component
const Pagination = ({ pagination, onPageChange }: { pagination: PaginationType, onPageChange: (page: number) => void }) => {
  const { currentPage, totalPages, hasNextPage, hasPreviousPage } = pagination;
  
  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages = [];
    const maxPagesToShow = 5;
    
    if (totalPages <= maxPagesToShow) {
      // Show all pages if total pages is less than or equal to maxPagesToShow
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      // Calculate start and end of page range around current page
      let startPage = Math.max(2, currentPage - 1);
      let endPage = Math.min(totalPages - 1, currentPage + 1);
      
      // Adjust if we're at the start or end
      if (currentPage <= 2) {
        endPage = Math.min(totalPages - 1, 4);
      } else if (currentPage >= totalPages - 1) {
        startPage = Math.max(2, totalPages - 3);
      }
      
      // Add ellipsis if needed before startPage
      if (startPage > 2) {
        pages.push('...');
      }
      
      // Add page numbers in range
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
      
      // Add ellipsis if needed after endPage
      if (endPage < totalPages - 1) {
        pages.push('...');
      }
      
      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }
    
    return pages;
  };
  
  return (
    <div className="flex items-center justify-center space-x-2 my-6">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={!hasPreviousPage}
        className={`px-3 py-1 rounded border ${!hasPreviousPage ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
      >
        Previous
      </button>
      
      {getPageNumbers().map((page, index) => (
        <button
          key={index}
          onClick={() => typeof page === 'number' ? onPageChange(page) : null}
          disabled={typeof page !== 'number'}
          className={`w-8 h-8 flex items-center justify-center rounded ${typeof page !== 'number' ? 'cursor-default' : page === currentPage ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 border'}`}
        >
          {page}
        </button>
      ))}
      
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={!hasNextPage}
        className={`px-3 py-1 rounded border ${!hasNextPage ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
      >
        Next
      </button>
    </div>
  );
};

// Search results container component
const SearchResults = ({ results, pagination, onPageChange }: { results: SearchResultType[], pagination?: PaginationType, onPageChange?: (page: number) => void }) => {
  return (
    <div className="w-[600px] max-w-full px-4 mb-10">
      <h2 className="text-xl font-medium mb-4">Results</h2>
      <div>
        {results.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No search results found. Try a different search term.
          </div>
        ) : (
          <>
            {results.map((result, index) => (
              <SearchResult
                key={`${result.id}-${result.source}-${index}`}
                title={result.title}
                description={result.description}
                image={result.image}
                type={result.type}
                link={result.url}
              />
            ))}
            
            {pagination && onPageChange && pagination.totalPages > 1 && (
              <Pagination pagination={pagination} onPageChange={onPageChange} />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default function Home() {
  const [searchQuery, setSearchQuery] = useState(
    typeof window !== 'undefined' ? localStorage.getItem('lastSearchQuery') || 'Volcanoes' : 'Volcanoes'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [allSearchResults, setAllSearchResults] = useState<SearchResultType[]>([]);
  const [searchAgentActions, setSearchAgentActions] = useState(defaultSearchAgentActions);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Compute pagination data
  const totalItems = allSearchResults.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  
  // Get current page results
  const searchResults = allSearchResults.slice(startIndex, endIndex);
  
  // Compute pagination state
  const pagination: PaginationType = {
    currentPage,
    totalPages,
    pageSize,
    totalItems,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1
  };

  useEffect(() => {
    const fetchLatestSearchResults = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data, error } = await supabase
          .from('search_results')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (data && !error) {
          setSearchResults(data.map(result => ({
            id: result.id,
            title: result.title,
            description: result.description || '',
            image: result.image_url || '',
            type: result.type,
            source: result.source,
            url: result.link,
            created_at: result.created_at
          })));
        }
      }
    };

    fetchLatestSearchResults();
  }, []);

  const handleSearch = async (e: React.FormEvent | null) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setAllSearchResults([]);
    setCurrentPage(1);
    setSearchAgentActions([...defaultSearchAgentActions]);

    if (typeof window !== 'undefined') {
      localStorage.setItem('lastSearchQuery', searchQuery);
    }
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          searchQuery,
          page: 1,
          pageSize: 100 // Fetch more results at once
        }),
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      setAllSearchResults(data.results);
      setSearchAgentActions([...defaultSearchAgentActions, `Found ${data.results.length} resources across educational platforms`]);
    } catch (error) {
      console.error('Search error:', error);
      setSearchAgentActions([...searchAgentActions, 'An error occurred while searching']);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle page change
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    // Scroll to top of results
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="flex flex-col items-center w-[600px] max-w-full mx-auto">
      <div className="px-4 flex-1 w-full mb-2">
        {/* Search bar - alone on top row */}
        <form onSubmit={handleSearch} className="w-full">
            <div className="flex items-center bg-[#f2f2f7] rounded-lg shadow-sm border border-[#e5e5ea] transition-all duration-200 focus-within:ring-1 focus-within:ring-[#8e8e93] overflow-hidden mb-2">
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-grow h-12 pl-4 bg-transparent text-base text-[#1c1c1e] placeholder:text-[#8e8e93] focus:outline-none"
              />
              <button
                type="submit"
                disabled={isLoading}
                className={`${isLoading ? 'bg-[#8e8e93]' : 'bg-[#1c1c1e]'} text-white w-12 h-12 flex items-center justify-center hover:bg-[#3a3a3c] transition duration-200`}
              >
                <Search className="w-5 h-5" />
              </button>
            </div>
          </form>
          
          {/* Grade Selector - moved below search bar, aligned left, smaller */}
          <div className="flex justify-start mb-6">
            <div className="relative">
              <select 
                defaultValue="all"
                className="appearance-none h-8 pl-3 pr-8 bg-[#f2f2f7] rounded-md text-sm text-[#1c1c1e] border border-[#e5e5ea] focus:outline-none focus:ring-1 focus:ring-[#8e8e93]"
              >
                {gradeOptions.map((grade) => (
                  <option key={grade.id} value={grade.value}>
                    {grade.label}
                  </option>
                ))}
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                <ChevronDown className="w-3 h-3 text-[#8e8e93]" />
              </div>
            </div>
          </div>
        </div>
        
        {/* Search agent actions area */}
        <div className="w-[600px] max-w-full px-4 mb-10">
          <div className="rounded-lg border border-[#e5e5ea] bg-white p-4 shadow-sm">
            <h3 className="text-lg font-medium mb-3 text-[#1c1c1e]">Astral is looking for resources...</h3>
            <div className="space-y-2.5">
              {searchAgentActions.map((action, index) => (
                <div key={index} className="text-[#3a3a3c] text-sm border-l-2 border-gray-200 pl-3 py-0.5">
                  {action}
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Search results section */}
        {/* Loading indicator */}
        {isLoading && (
          <div className="flex flex-col justify-center items-center py-8 space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            <p className="text-gray-600 text-sm animate-pulse">Searching across educational resources...</p>
          </div>
        )}
        
        {/* Search Results */}
        {!isLoading && searchResults.length > 0 && (
          <SearchResults 
            results={searchResults} 
            pagination={pagination} 
            onPageChange={handlePageChange} 
          />
        )}
      </div>
    );
}