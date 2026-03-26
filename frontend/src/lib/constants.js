// Publish Itt - Genre and Age Group Constants

export const GENRES = [
  // Fiction
  { value: "literary-fiction", label: "Literary Fiction", category: "Fiction" },
  { value: "contemporary-fiction", label: "Contemporary Fiction", category: "Fiction" },
  { value: "historical-fiction", label: "Historical Fiction", category: "Fiction" },
  { value: "womens-fiction", label: "Women's Fiction", category: "Fiction" },
  
  // Romance
  { value: "contemporary-romance", label: "Contemporary Romance", category: "Romance" },
  { value: "historical-romance", label: "Historical Romance", category: "Romance" },
  { value: "paranormal-romance", label: "Paranormal Romance", category: "Romance" },
  { value: "romantic-suspense", label: "Romantic Suspense", category: "Romance" },
  { value: "romantic-comedy", label: "Romantic Comedy", category: "Romance" },
  
  // Mystery & Thriller
  { value: "mystery", label: "Mystery", category: "Mystery & Thriller" },
  { value: "cozy-mystery", label: "Cozy Mystery", category: "Mystery & Thriller" },
  { value: "thriller", label: "Thriller", category: "Mystery & Thriller" },
  { value: "psychological-thriller", label: "Psychological Thriller", category: "Mystery & Thriller" },
  { value: "crime-fiction", label: "Crime Fiction", category: "Mystery & Thriller" },
  { value: "suspense", label: "Suspense", category: "Mystery & Thriller" },
  
  // Science Fiction & Fantasy
  { value: "epic-fantasy", label: "Epic Fantasy", category: "Science Fiction & Fantasy" },
  { value: "urban-fantasy", label: "Urban Fantasy", category: "Science Fiction & Fantasy" },
  { value: "dark-fantasy", label: "Dark Fantasy", category: "Science Fiction & Fantasy" },
  { value: "science-fiction", label: "Science Fiction", category: "Science Fiction & Fantasy" },
  { value: "space-opera", label: "Space Opera", category: "Science Fiction & Fantasy" },
  { value: "dystopian", label: "Dystopian", category: "Science Fiction & Fantasy" },
  { value: "post-apocalyptic", label: "Post-Apocalyptic", category: "Science Fiction & Fantasy" },
  { value: "steampunk", label: "Steampunk", category: "Science Fiction & Fantasy" },
  
  // Horror
  { value: "horror", label: "Horror", category: "Horror" },
  { value: "supernatural-horror", label: "Supernatural Horror", category: "Horror" },
  { value: "gothic", label: "Gothic", category: "Horror" },
  
  // Young Adult & Children
  { value: "young-adult", label: "Young Adult", category: "Young Adult & Children" },
  { value: "ya-fantasy", label: "YA Fantasy", category: "Young Adult & Children" },
  { value: "ya-contemporary", label: "YA Contemporary", category: "Young Adult & Children" },
  { value: "middle-grade", label: "Middle Grade", category: "Young Adult & Children" },
  { value: "chapter-books", label: "Chapter Books", category: "Young Adult & Children" },
  { value: "picture-books", label: "Picture Books", category: "Young Adult & Children" },
  { value: "early-readers", label: "Early Readers", category: "Young Adult & Children" },
  
  // Non-Fiction
  { value: "memoir", label: "Memoir", category: "Non-Fiction" },
  { value: "biography", label: "Biography", category: "Non-Fiction" },
  { value: "self-help", label: "Self-Help", category: "Non-Fiction" },
  { value: "business", label: "Business", category: "Non-Fiction" },
  { value: "history", label: "History", category: "Non-Fiction" },
  { value: "science", label: "Science", category: "Non-Fiction" },
  { value: "true-crime", label: "True Crime", category: "Non-Fiction" },
  { value: "travel", label: "Travel", category: "Non-Fiction" },
  { value: "cooking", label: "Cooking & Food", category: "Non-Fiction" },
  { value: "health", label: "Health & Wellness", category: "Non-Fiction" },
  
  // Other
  { value: "poetry", label: "Poetry", category: "Other" },
  { value: "short-stories", label: "Short Stories", category: "Other" },
  { value: "anthology", label: "Anthology", category: "Other" },
  { value: "graphic-novel", label: "Graphic Novel", category: "Other" },
  { value: "screenplay", label: "Screenplay", category: "Other" },
];

export const AGE_GROUPS = [
  { value: "board-books", label: "Board Books (0-3 years)", minAge: 0, maxAge: 3 },
  { value: "picture-books", label: "Picture Books (3-5 years)", minAge: 3, maxAge: 5 },
  { value: "early-readers", label: "Early Readers (5-7 years)", minAge: 5, maxAge: 7 },
  { value: "chapter-books", label: "Chapter Books (6-9 years)", minAge: 6, maxAge: 9 },
  { value: "middle-grade", label: "Middle Grade (8-12 years)", minAge: 8, maxAge: 12 },
  { value: "young-adult", label: "Young Adult (12-18 years)", minAge: 12, maxAge: 18 },
  { value: "new-adult", label: "New Adult (18-25 years)", minAge: 18, maxAge: 25 },
  { value: "adult", label: "Adult (18+ years)", minAge: 18, maxAge: 99 },
  { value: "all-ages", label: "All Ages", minAge: 0, maxAge: 99 },
];

export const WRITING_STYLES = [
  { value: "literary", label: "Literary", description: "Emphasis on prose style and complex themes" },
  { value: "commercial", label: "Commercial", description: "Plot-driven, accessible, page-turner" },
  { value: "lyrical", label: "Lyrical", description: "Poetic, evocative, sensory-rich" },
  { value: "minimalist", label: "Minimalist", description: "Sparse, direct, Hemingway-esque" },
  { value: "descriptive", label: "Descriptive", description: "Rich detail, world-building focus" },
  { value: "conversational", label: "Conversational", description: "Casual, engaging, first-person feel" },
  { value: "dramatic", label: "Dramatic", description: "High emotion, tension-focused" },
  { value: "humorous", label: "Humorous", description: "Witty, comedic, light-hearted" },
  { value: "dark", label: "Dark", description: "Gritty, intense, mature themes" },
  { value: "whimsical", label: "Whimsical", description: "Playful, imaginative, magical" },
  { value: "suspenseful", label: "Suspenseful", description: "Tension-building, mystery-driven" },
  { value: "heartfelt", label: "Heartfelt", description: "Emotional, character-driven, warm" },
];

export const PROJECT_STATUSES = [
  { value: "idea", label: "Idea", color: "bg-purple-500" },
  { value: "outline", label: "Outline", color: "bg-blue-500" },
  { value: "draft", label: "First Draft", color: "bg-amber-500" },
  { value: "revision", label: "Revision", color: "bg-orange-500" },
  { value: "editing", label: "Editing", color: "bg-cyan-500" },
  { value: "beta", label: "Beta Reading", color: "bg-teal-500" },
  { value: "final", label: "Final Draft", color: "bg-green-500" },
  { value: "published", label: "Published", color: "bg-emerald-600" },
];

// Helper function to get genres grouped by category
export function getGenresByCategory() {
  return GENRES.reduce((acc, genre) => {
    if (!acc[genre.category]) {
      acc[genre.category] = [];
    }
    acc[genre.category].push(genre);
    return acc;
  }, {});
}
