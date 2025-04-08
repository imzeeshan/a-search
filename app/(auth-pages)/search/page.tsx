'use client';

import { Search, ChevronDown } from 'lucide-react';
import { useState, useEffect, useTransition, useActionState } from 'react';
import { search } from '@/app/actions/search';

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

// Search result component
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
const SearchResults = ({ results, pagination, onPageChange }: { results: SearchResult[], pagination?: PaginationType, onPageChange?: (page: number) => void }) => {
  return (
    <div className="w-[600px] max-w-full px-4 mb-10">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-medium">Results</h2>
        <span className="text-sm text-gray-600">
          {pagination ? `Showing ${(pagination.currentPage - 1) * pagination.pageSize + 1} - ${Math.min(pagination.currentPage * pagination.pageSize, pagination.totalItems)} of ${pagination.totalItems}` : ''}
        </span>
      </div>
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
              <div className="mt-6 border-t pt-6">
                <Pagination pagination={pagination} onPageChange={onPageChange} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

type SearchState = {
  results: SearchResult[];
  pagination: PaginationType;
  pending?: boolean;
};

const initialState: SearchState = {
  results: [],
  pagination: {
    currentPage: 1,
    totalPages: 1,
    pageSize: 10,
    totalItems: 0,
    hasNextPage: false,
    hasPreviousPage: false
  },
  pending: false
};

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchAgentActions, setSearchAgentActions] = useState(defaultSearchAgentActions);
  const [isPending, startTransition] = useTransition();
  const [state, formAction] = useActionState<SearchState>(search, initialState);

  const isLoading = state?.pending || false;

  // Handle search form submission
  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set('page', '1'); // Reset to first page on new search
    setCurrentPage(1);
    
    startTransition(() => {
      formAction(formData);
    });
  };

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    const formData = new FormData();
    formData.set('searchQuery', searchQuery);
    formData.set('page', newPage.toString());
    formData.set('pageSize', '10');
    
    startTransition(() => {
      formAction(formData);
    });
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchQuery('');
    setCurrentPage(1);
    const formData = new FormData();
    formData.set('searchQuery', '');
    formData.set('page', '1');
    formData.set('pageSize', '10');
    
    startTransition(() => {
      formAction(formData);
    });
  };

  useEffect(() => {
    // Load initial results
    const formData = new FormData();
    formData.set('searchQuery', '');
    formData.set('page', '1');
    formData.set('pageSize', '10');
    
    startTransition(() => {
      formAction(formData);
    });
  }, []);

  const isSearching = isLoading || isPending;

  return (
    <div className="flex flex-col items-center w-[600px] max-w-full mx-auto">
      <div className="px-4 flex-1 w-full mb-2">
        {/* Search bar - alone on top row */}
        <form onSubmit={handleSearch} className="w-full">
          <div className="flex items-center bg-[#f2f2f7] rounded-lg shadow-sm border border-[#e5e5ea] transition-all duration-200 focus-within:ring-1 focus-within:ring-[#8e8e93] overflow-hidden mb-2">
            <input
              type="text"
              name="searchQuery"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-grow h-12 pl-4 bg-transparent text-base text-[#1c1c1e] placeholder:text-[#8e8e93] focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="px-3 text-[#8e8e93] hover:text-[#3a3a3c]"
              >
                Clear
              </button>
            )}
            <button
              type="submit"
              disabled={isSearching}
              className={`${isSearching ? 'bg-[#8e8e93]' : 'bg-[#1c1c1e]'} text-white w-12 h-12 flex items-center justify-center hover:bg-[#3a3a3c] transition duration-200`}
            >
              <Search className="w-5 h-5" />
            </button>
          </div>
          <input type="hidden" name="page" value={currentPage} />
          <input type="hidden" name="pageSize" value="10" />
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
        
      {/* Search agent actions area - show whenever searching */}
      {isSearching && (
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
            <div className="mt-4 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          </div>
        </div>
      )}
        
      {/* Search Results */}
      {!isSearching && state && state.results && state.results.length > 0 && (
        <SearchResults 
          results={state.results} 
          pagination={state.pagination} 
          onPageChange={handlePageChange} 
        />
      )}
    </div>
  );
}