// dataManager.js - Data, Authentication, and Upload Manager

let portfolioData = null;

// Helper: Hashing passwords with Web Cryptography API
async function hashPassword(password, salt) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate random salt
function generateSalt() {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
}

export const DataManager = {
    // Initialize Data Manager
    async init() {
        // 1. Try to load from localStorage (most recent local changes)
        const localCached = localStorage.getItem('portfolio_data');
        if (localCached) {
            try {
                portfolioData = JSON.parse(localCached);
            } catch (e) {
                console.error('Failed to parse cached data', e);
            }
        }

        // 2. Try to fetch from SQLite API
        try {
            const apiRes = await fetch(`/api/data?t=${Date.now()}`);
            if (apiRes.ok) {
                const apiData = await apiRes.json();
                portfolioData = apiData;
                localStorage.setItem('portfolio_data', JSON.stringify(portfolioData));
                return portfolioData;
            }
        } catch (e) {
            // API server not available, fall through
        }

        // Helper to load env variables safely
        const getEnv = (key) => {
            try {
                return import.meta.env[key] || "";
            } catch (err) {
                return "";
            }
        };

        // Resolve config with fallback to environment variables
        const config = (portfolioData && portfolioData.config) ? portfolioData.config : {};
        const cloudConfig = {
            supabaseUrl: config.supabaseUrl || getEnv('VITE_SUPABASE_URL'),
            supabaseKey: config.supabaseKey || getEnv('VITE_SUPABASE_ANON_KEY'),
            firebaseUrl: config.firebaseUrl || getEnv('VITE_FIREBASE_URL')
        };

        // 3. Fetch from cloud using resolved config fallbacks
        if ((cloudConfig.supabaseUrl && cloudConfig.supabaseKey) || cloudConfig.firebaseUrl) {
            const cloudData = await this.fetchFromCloud(cloudConfig);
            if (cloudData) {
                portfolioData = cloudData;
                localStorage.setItem('portfolio_data', JSON.stringify(portfolioData));
                return portfolioData;
            }
        }

        // 4. Fallback/Default: Fetch from data.json on server
        try {
            const res = await fetch(`./data.json?t=${Date.now()}`);
            if (res.ok) {
                const serverData = await res.json();
                
                // If local storage is empty, initialize with server data
                if (!portfolioData) {
                    portfolioData = serverData;
                    localStorage.setItem('portfolio_data', JSON.stringify(portfolioData));
                } else {
                    // Merge configuration, keeping local structure but pulling admin hashes if empty
                    if (!portfolioData.admin || !portfolioData.admin.passwordHash) {
                        portfolioData.admin = serverData.admin;
                    }
                    if (serverData.setup && !portfolioData.setup) {
                        portfolioData.setup = serverData.setup;
                        portfolioData.admin = serverData.admin;
                    }
                }
            }
        } catch (e) {
            console.error('Could not fetch data.json', e);
        }

        // Return current state or empty fallback
        if (!portfolioData) {
            portfolioData = { setup: false, about: {}, projects: [], skills: [], experience: [], education: [], certificates: [], achievements: [], contact: {}, config: {} };
        }
        return portfolioData;
    },

    getData() {
        return portfolioData;
    },

    // Fetch from Cloud Database (Supabase / Firebase REST)
    async fetchFromCloud(config) {
        if (!config) return null;

        // Firebase REST API
        if (config.firebaseUrl) {
            try {
                const url = config.firebaseUrl.endsWith('.json') ? config.firebaseUrl : `${config.firebaseUrl.replace(/\/$/, '')}/portfolio.json`;
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    if (data) return data;
                }
            } catch (e) {
                console.warn('Firebase sync read failed', e);
            }
        }

        // Supabase REST API
        if (config.supabaseUrl && config.supabaseKey) {
            try {
                const url = `${config.supabaseUrl.replace(/\/$/, '')}/rest/v1/portfolio_data?select=content&id=eq.1`;
                const res = await fetch(url, {
                    headers: {
                        'apikey': config.supabaseKey,
                        'Authorization': `Bearer ${config.supabaseKey}`
                    }
                });
                if (res.ok) {
                    const rows = await res.json();
                    if (rows && rows.length > 0 && rows[0].content) {
                        return rows[0].content;
                    }
                }
            } catch (e) {
                console.warn('Supabase sync read failed', e);
            }
        }

        return null;
    },

    // Save Data
    async save(updatedData) {
        portfolioData = { ...portfolioData, ...updatedData };
        
        // Cache to local storage
        localStorage.setItem('portfolio_data', JSON.stringify(portfolioData));

        // 1. Sync to local development server if running locally
        try {
            const devServerRes = await fetch('/api/save-metadata', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(portfolioData)
            });
            if (devServerRes.ok) {
                console.log('Successfully saved to local server data.json');
            }
        } catch (e) {
            // Ignored if in static production mode
        }

        // 2. Sync to Firebase
        const config = portfolioData.config || {};
        if (config.firebaseUrl) {
            try {
                const url = config.firebaseUrl.endsWith('.json') ? config.firebaseUrl : `${config.firebaseUrl.replace(/\/$/, '')}/portfolio.json`;
                await fetch(url, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(portfolioData)
                });
                console.log('Synced to Firebase');
            } catch (e) {
                console.error('Firebase save failed', e);
            }
        }

        // 3. Sync to Supabase
        if (config.supabaseUrl && config.supabaseKey) {
            try {
                const url = `${config.supabaseUrl.replace(/\/$/, '')}/rest/v1/portfolio_data`;
                // First insert/upsert using POST with resolution=merge
                await fetch(url, {
                    method: 'POST',
                    headers: {
                        'apikey': config.supabaseKey,
                        'Authorization': `Bearer ${config.supabaseKey}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'resolution=merge-duplicates'
                    },
                    body: JSON.stringify({ id: 1, content: portfolioData })
                });
                console.log('Synced to Supabase');
            } catch (e) {
                console.error('Supabase save failed', e);
            }
        }

        return portfolioData;
    },

    // Image Upload
    async uploadImage(file) {
        const config = portfolioData.config || {};
        
        // Ensure it's an approved image format
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
        if (!validTypes.includes(file.type)) {
            throw new Error('Invalid image format. Supported: JPEG, PNG, GIF, WEBP, SVG');
        }

        // Restrict to 5MB
        if (file.size > 5 * 1024 * 1024) {
            throw new Error('File is too large. Max limit is 5MB.');
        }

        // Mode 1: Cloudinary upload
        if (config.imageStorage === 'cloudinary' && config.cloudinaryCloudName && config.cloudinaryUploadPreset) {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', config.cloudinaryUploadPreset);

            const url = `https://api.cloudinary.com/v1_1/${config.cloudinaryCloudName}/image/upload`;
            const res = await fetch(url, { method: 'POST', body: formData });
            if (res.ok) {
                const data = await res.json();
                return data.secure_url;
            }
            throw new Error('Cloudinary upload failed');
        }

        // Mode 2: ImgBB upload
        if (config.imageStorage === 'imgbb' && config.imgbbApiKey) {
            const formData = new FormData();
            formData.append('image', file);

            const url = `https://api.imgbb.com/1/upload?key=${config.imgbbApiKey}`;
            const res = await fetch(url, { method: 'POST', body: formData });
            if (res.ok) {
                const data = await res.json();
                return data.data.url;
            }
            throw new Error('ImgBB upload failed');
        }

        // Mode 3: Local Dev Server Upload (via middleware)
        try {
            const filename = `${crypto.randomUUID()}-${file.name.replace(/\s+/g, '_')}`;
            const res = await fetch(`/api/upload?filename=${encodeURIComponent(filename)}`, {
                method: 'POST',
                body: file
            });
            if (res.ok) {
                const data = await res.json();
                return data.path; // e.g. ./assets/uuid-filename.png
            }
        } catch (e) {
            // Fallback to base64 if local API upload fails (e.g. running statically without dev server)
        }

        // Mode 4: Base64 fallback (useful for static deploys with no cloud configuration)
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = (error) => reject(error);
        });
    },

    // Admin Auth Actions
    async setupAdmin(email, password) {
        const salt = generateSalt();
        const passwordHash = await hashPassword(password, salt);

        const admin = {
            username: email,
            passwordHash: passwordHash,
            salt: salt
        };

        await this.save({
            setup: true,
            admin: admin
        });
        return true;
    },

    async changeAdminCredentials(email, currentPassword, newPassword) {
        if (!portfolioData.setup) {
            return this.setupAdmin(email, newPassword);
        }

        const isCorrect = await this.verifyPassword(currentPassword);
        if (!isCorrect) {
            throw new Error('Incorrect current password.');
        }

        const salt = generateSalt();
        const passwordHash = await hashPassword(newPassword, salt);

        const admin = {
            username: email,
            passwordHash: passwordHash,
            salt: salt
        };

        await this.save({ admin });
        return true;
    },

    async verifyPassword(password) {
        if (!portfolioData || !portfolioData.admin) return false;
        const { passwordHash, salt } = portfolioData.admin;
        if (!passwordHash) return false;
        const testHash = await hashPassword(password, salt);
        return testHash === passwordHash;
    },

    async login(email, password) {
        if (!portfolioData.setup) {
            // If not setup, first login is a setup
            await this.setupAdmin(email, password);
            this.createSession();
            return { success: true, message: 'Setup complete and logged in' };
        }

        const testEmail = portfolioData.admin.username;
        const isEmailCorrect = email.toLowerCase().trim() === testEmail.toLowerCase().trim();
        const isPasswordCorrect = await this.verifyPassword(password);

        if (isEmailCorrect && isPasswordCorrect) {
            this.createSession();
            return { success: true };
        }
        return { success: false, message: 'Invalid email or password' };
    },

    createSession() {
        const session = {
            authenticated: true,
            expiresAt: Date.now() + 60 * 60 * 1000 // 1 hour session
        };
        sessionStorage.setItem('portfolio_admin_session', JSON.stringify(session));
    },

    logout() {
        sessionStorage.removeItem('portfolio_admin_session');
    },

    isLoggedIn() {
        const sessionStr = sessionStorage.getItem('portfolio_admin_session');
        if (!sessionStr) return false;
        try {
            const session = JSON.parse(sessionStr);
            if (session.authenticated && session.expiresAt > Date.now()) {
                // Refresh session expiration on user action
                session.expiresAt = Date.now() + 60 * 60 * 1000;
                sessionStorage.setItem('portfolio_admin_session', JSON.stringify(session));
                return true;
            }
        } catch (e) {
            // invalid session
        }
        this.logout();
        return false;
    }
};
