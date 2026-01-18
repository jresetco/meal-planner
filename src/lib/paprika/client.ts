/**
 * Paprika 3 API Client
 * Based on unofficial API documentation:
 * - https://gist.github.com/mattdsteele/7386ec363badfdeaad05a418b9a1f30a
 * - https://github.com/Syfaro/paprika-rs
 */

interface PaprikaRecipe {
  uid: string
  name: string
  ingredients: string
  directions: string
  servings: string
  rating: number
  difficulty: string
  prep_time: string
  cook_time: string
  total_time: string
  source: string
  source_url: string
  image_url: string
  photo: string // Base64 encoded image
  photo_large: string
  categories: string[]
  created: string
  hash: string
  on_favorites: boolean
  in_trash: boolean
}

interface PaprikaAuthResponse {
  result: {
    token: string
  }
}

interface PaprikaRecipesResponse {
  result: PaprikaRecipe[]
}

export class PaprikaClient {
  private baseUrl = 'https://www.paprikaapp.com/api/v2'
  private token: string | null = null

  /**
   * Authenticate with Paprika
   * Note: Paprika requires an iOS User-Agent for login requests to be accepted
   */
  async login(email: string, password: string): Promise<void> {
    // Trim and validate inputs (keep original case for email as Paprika may be case-sensitive)
    const cleanEmail = email.trim()
    const cleanPassword = password.trim()
    
    if (!cleanEmail || !cleanPassword) {
      throw new Error('Email and password are required')
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(cleanEmail)) {
      throw new Error('Invalid email address format')
    }
    
    console.log('Attempting Paprika login for:', cleanEmail)
    
    // Paprika requires an iOS User-Agent for login requests
    // Using a realistic iOS User-Agent string
    const iosUserAgent = 'Paprika/3.8.0 (iPhone; iOS 17.0; Scale/3.00)'
    
    try {
      const response = await fetch(`${this.baseUrl}/account/login/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': iosUserAgent,
          'Accept': 'application/json',
        },
        body: new URLSearchParams({
          email: cleanEmail,
          password: cleanPassword,
        }).toString(),
      })

      // Try to parse response as JSON, but handle non-JSON responses
      let data: any
      const contentType = response.headers.get('content-type')
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json()
      } else {
        const text = await response.text()
        console.error('Non-JSON response from Paprika:', text)
        throw new Error(`Paprika API returned non-JSON response: ${response.status} ${text.substring(0, 200)}`)
      }
      
      console.log('Paprika API response status:', response.status)
      console.log('Paprika API response data:', JSON.stringify(data, null, 2))
      
      // Check for error response first
      if (data.error) {
        const errorMsg = data.error.message || data.error || JSON.stringify(data.error)
        if (errorMsg.toLowerCase().includes('email') || errorMsg.toLowerCase().includes('invalid')) {
          throw new Error(`Invalid email address or password. Please verify your Paprika Cloud Sync credentials are correct and that Cloud Sync is enabled in your Paprika app.`)
        }
        throw new Error(`Paprika API error: ${errorMsg}`)
      }
      
      if (!response.ok) {
        // Provide more specific error messages based on status code
        if (response.status === 401 || response.status === 403) {
          throw new Error('Invalid email address or password. Please check your Paprika Cloud Sync credentials.')
        } else if (response.status === 404) {
          throw new Error('Paprika API endpoint not found. The API may have changed.')
        } else if (response.status >= 500) {
          throw new Error('Paprika server error. Please try again later.')
        }
        throw new Error(`Paprika authentication failed: ${response.status} ${JSON.stringify(data)}`)
      }
      
      // Handle different possible success response structures
      if (data.token) {
        this.token = data.token
      } else if (data.result && data.result.token) {
        this.token = data.result.token
      } else if (data.result && typeof data.result === 'string') {
        // Some versions return token directly in result
        this.token = data.result
      } else {
        throw new Error(`Unexpected Paprika API response structure. Expected token but got: ${JSON.stringify(data)}`)
      }
      
      if (!this.token) {
        throw new Error('Authentication succeeded but no token was returned')
      }
      
      console.log('Paprika authentication successful')
    } catch (error) {
      // Re-throw if it's already our custom error
      if (error instanceof Error) {
        throw error
      }
      // Handle network errors
      throw new Error(`Network error connecting to Paprika: ${error}`)
    }
  }

  /**
   * Get all recipes from Paprika
   */
  async getRecipes(): Promise<PaprikaRecipe[]> {
    if (!this.token) {
      throw new Error('Not authenticated. Call login() first.')
    }

    const response = await fetch(`${this.baseUrl}/sync/recipes/`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('Authentication token expired. Please sync again.')
      }
      const errorText = await response.text()
      throw new Error(`Failed to fetch recipes from Paprika: ${response.status} ${errorText.substring(0, 200)}`)
    }

    const data: PaprikaRecipesResponse = await response.json()
    
    if (!data.result || !Array.isArray(data.result)) {
      throw new Error('Invalid response format from Paprika recipes endpoint')
    }
    
    return data.result.filter((recipe) => !recipe.in_trash)
  }

  /**
   * Get a single recipe with full details
   */
  async getRecipe(uid: string): Promise<PaprikaRecipe> {
    if (!this.token) {
      throw new Error('Not authenticated. Call login() first.')
    }

    const response = await fetch(`${this.baseUrl}/sync/recipe/${uid}/`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('Authentication token expired. Please sync again.')
      }
      const errorText = await response.text()
      throw new Error(`Failed to fetch recipe ${uid} from Paprika: ${response.status} ${errorText.substring(0, 200)}`)
    }

    const data = await response.json()
    
    if (!data.result) {
      throw new Error(`Invalid response format for recipe ${uid}`)
    }
    
    return data.result
  }

  /**
   * Filter recipes by rating and categories
   */
  filterRecipes(
    recipes: PaprikaRecipe[],
    options: {
      minRating?: number
      categories?: string[]
    } = {}
  ): PaprikaRecipe[] {
    let filtered = recipes

    // Filter by minimum rating
    if (options.minRating !== undefined) {
      filtered = filtered.filter((recipe) => recipe.rating >= options.minRating!)
    }

    // Filter by categories (if specified, only include recipes with ANY of these categories)
    if (options.categories && options.categories.length > 0) {
      filtered = filtered.filter((recipe) =>
        recipe.categories.some((cat) =>
          options.categories!.some((filterCat) =>
            cat.toLowerCase().includes(filterCat.toLowerCase())
          )
        )
      )
    }

    return filtered
  }

  /**
   * Parse ingredients string into array
   */
  parseIngredients(ingredientsString: string): Array<{ name: string; quantity?: string; unit?: string }> {
    if (!ingredientsString) return []

    return ingredientsString
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        // Simple parsing - just store as name for now
        // More sophisticated parsing could extract quantity/unit
        return { name: line.trim() }
      })
  }
}

/**
 * Create and authenticate a Paprika client
 */
export async function createPaprikaClient(email: string, password: string): Promise<PaprikaClient> {
  const client = new PaprikaClient()
  await client.login(email, password)
  return client
}
