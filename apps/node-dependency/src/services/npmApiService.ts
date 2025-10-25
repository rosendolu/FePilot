import * as vscode from 'vscode';

/**
 * Comprehensive package.json structure from npm registry
 */
export interface NpmPackageInfo {
    name: string;
    version: string;
    description?: string;
    keywords?: string[];
    homepage?: string;
    repository?: {
        type: string;
        url: string;
        directory?: string;
    };
    bugs?: {
        url: string;
        email?: string;
    };
    license?: string;
    author?:
        | string
        | {
              name: string;
              email?: string;
              url?: string;
          };
    maintainers?: Array<{
        name: string;
        email: string;
    }>;
    contributors?: Array<{
        name: string;
        email?: string;
        url?: string;
    }>;
    engines?: {
        [key: string]: string;
    };
    main?: string;
    module?: string;
    types?: string;
    typings?: string;
    bin?:
        | string
        | {
              [key: string]: string;
          };
    scripts?: {
        [key: string]: string;
    };
    dependencies?: {
        [key: string]: string;
    };
    devDependencies?: {
        [key: string]: string;
    };
    peerDependencies?: {
        [key: string]: string;
    };
    optionalDependencies?: {
        [key: string]: string;
    };
    bundledDependencies?: string[];
    os?: string[];
    cpu?: string[];
    preferGlobal?: boolean;
    private?: boolean;
    publishConfig?: {
        [key: string]: any;
    };
    dist?: {
        integrity: string;
        shasum: string;
        tarball: string;
        fileCount: number;
        unpackedSize: number;
    };
    time?: {
        [key: string]: string;
    };
    versions?: {
        [key: string]: NpmPackageInfo;
    };
    'dist-tags'?: {
        [key: string]: string;
    };
    readme?: string;
    readmeFilename?: string;
    _id?: string;
    _rev?: string;
    _npmUser?: {
        name: string;
        email: string;
    };
    _npmVersion?: string;
    _nodeVersion?: string;
    _npmOperationalInternal?: {
        host: string;
        tmp: string;
    };
}

/**
 * NPM API Service for querying package information
 */
export class NpmApiService {
    private static readonly NPM_REGISTRY = 'https://registry.npmjs.org';
    private static readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour
    private static cache = new Map<string, { data: NpmPackageInfo; timestamp: number }>();

    /**
     * Get package information from npm registry
     */
    static async getPackageInfo(
        packageName: string,
        version?: string
    ): Promise<NpmPackageInfo | null> {
        try {
            const cacheKey = version ? `${packageName}@${version}` : packageName;

            // Check cache first
            const cached = this.cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
                return cached.data;
            }

            // Build URL
            let url = `${this.NPM_REGISTRY}/${encodeURIComponent(packageName)}`;
            if (version) {
                url += `/${encodeURIComponent(version)}`;
            }

            // Fetch from npm registry
            const response = await fetch(url);
            if (!response.ok) {
                if (response.status === 404) {
                    vscode.window.showWarningMessage(
                        `Package '${packageName}' not found on npm registry`
                    );
                    return null;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = (await response.json()) as NpmPackageInfo;

            // Cache the result
            this.cache.set(cacheKey, { data, timestamp: Date.now() });

            return data;
        } catch (error) {
            console.error(`Error fetching package info for ${packageName}:`, error);
            vscode.window.showErrorMessage(`Failed to fetch package information: ${error}`);
            return null;
        }
    }

    /**
     * Get latest version of a package
     */
    static async getLatestVersion(packageName: string): Promise<string | null> {
        try {
            const packageInfo = await this.getPackageInfo(packageName);
            if (!packageInfo) {
                return null;
            }

            // Get latest version from dist-tags
            if (packageInfo['dist-tags']?.latest) {
                return packageInfo['dist-tags'].latest;
            }

            // Fallback to latest version in versions object
            if (packageInfo.versions) {
                const versions = Object.keys(packageInfo.versions);
                if (versions.length > 0) {
                    return versions.sort((a, b) => {
                        // Simple version comparison (could be improved with semver)
                        return b.localeCompare(a, undefined, { numeric: true });
                    })[0];
                }
            }

            return packageInfo.version || null;
        } catch (error) {
            console.error(`Error getting latest version for ${packageName}:`, error);
            return null;
        }
    }

    /**
     * Get all available versions of a package
     */
    static async getPackageVersions(packageName: string): Promise<string[]> {
        try {
            const packageInfo = await this.getPackageInfo(packageName);
            if (!packageInfo || !packageInfo.versions) {
                return [];
            }

            return Object.keys(packageInfo.versions).sort((a, b) => {
                return b.localeCompare(a, undefined, { numeric: true });
            });
        } catch (error) {
            console.error(`Error getting versions for ${packageName}:`, error);
            return [];
        }
    }

    /**
     * Get package dependencies
     */
    static async getPackageDependencies(
        packageName: string,
        version?: string
    ): Promise<{
        dependencies: { [key: string]: string };
        devDependencies: { [key: string]: string };
        peerDependencies: { [key: string]: string };
        optionalDependencies: { [key: string]: string };
    }> {
        try {
            const packageInfo = await this.getPackageInfo(packageName, version);
            if (!packageInfo) {
                return {
                    dependencies: {},
                    devDependencies: {},
                    peerDependencies: {},
                    optionalDependencies: {},
                };
            }

            return {
                dependencies: packageInfo.dependencies || {},
                devDependencies: packageInfo.devDependencies || {},
                peerDependencies: packageInfo.peerDependencies || {},
                optionalDependencies: packageInfo.optionalDependencies || {},
            };
        } catch (error) {
            console.error(`Error getting dependencies for ${packageName}:`, error);
            return {
                dependencies: {},
                devDependencies: {},
                peerDependencies: {},
                optionalDependencies: {},
            };
        }
    }

    /**
     * Get package readme content
     */
    static async getPackageReadme(packageName: string, version?: string): Promise<string | null> {
        try {
            const packageInfo = await this.getPackageInfo(packageName, version);
            if (!packageInfo) {
                return null;
            }

            return packageInfo.readme || null;
        } catch (error) {
            console.error(`Error getting readme for ${packageName}:`, error);
            return null;
        }
    }

    /**
     * Search packages with detailed information
     */
    static async searchPackages(query: string, limit: number = 10): Promise<NpmPackageInfo[]> {
        try {
            const response = await fetch(
                `${this.NPM_REGISTRY}/-/v1/search?text=${encodeURIComponent(query)}&size=${limit}`
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = (await response.json()) as any;
            return data.objects.map((obj: any) => obj.package as NpmPackageInfo);
        } catch (error) {
            console.error(`Error searching packages:`, error);
            vscode.window.showErrorMessage(`Failed to search packages: ${error}`);
            return [];
        }
    }

    /**
     * Clear cache
     */
    static clearCache(): void {
        this.cache.clear();
    }

    /**
     * Get cache statistics
     */
    static getCacheStats(): { size: number; entries: string[] } {
        return {
            size: this.cache.size,
            entries: Array.from(this.cache.keys()),
        };
    }

    /**
     * Format package information for display
     */
    static formatPackageInfo(packageInfo: NpmPackageInfo): string {
        let formatted = `**${packageInfo.name}** v${packageInfo.version}\n\n`;

        if (packageInfo.description) {
            formatted += `*${packageInfo.description}*\n\n`;
        }

        if (packageInfo.keywords && packageInfo.keywords.length > 0) {
            formatted += `🏷️ **Keywords:** ${packageInfo.keywords.join(', ')}\n\n`;
        }

        if (packageInfo.author) {
            let authorInfo = '';
            if (typeof packageInfo.author === 'string') {
                authorInfo = packageInfo.author;
            } else if (typeof packageInfo.author === 'object') {
                const author = packageInfo.author;
                authorInfo = author.name;
                if (author.email) {
                    authorInfo += ` <${author.email}>`;
                }
                if (author.url) {
                    authorInfo += ` (${author.url})`;
                }
            }
            if (authorInfo) {
                formatted += `👤 **Author:** ${authorInfo}\n\n`;
            }
        }

        if (packageInfo.license) {
            formatted += `📄 **License:** ${packageInfo.license}\n\n`;
        }

        if (packageInfo.repository) {
            let repoInfo = '';
            if (typeof packageInfo.repository === 'string') {
                repoInfo = packageInfo.repository;
            } else if (typeof packageInfo.repository === 'object' && packageInfo.repository.url) {
                repoInfo = packageInfo.repository.url;
            }
            if (repoInfo) {
                const cleanUrl = repoInfo.replace(/^git\+/, '').replace(/\.git$/, '');
                formatted += `📦 **Repository:** [${cleanUrl}](${cleanUrl})\n\n`;
            }
        }

        if (packageInfo.homepage) {
            formatted += `🌐 **Homepage:** [${packageInfo.homepage}](${packageInfo.homepage})\n\n`;
        }

        if (packageInfo.bugs) {
            let bugsUrl = '';
            if (typeof packageInfo.bugs === 'string') {
                bugsUrl = packageInfo.bugs;
            } else if (typeof packageInfo.bugs === 'object' && packageInfo.bugs.url) {
                bugsUrl = packageInfo.bugs.url;
            }
            if (bugsUrl) {
                formatted += `🐛 **Issues:** [${bugsUrl}](${bugsUrl})\n\n`;
            }
        }

        if (packageInfo.engines) {
            const engineEntries = Object.entries(packageInfo.engines);
            if (engineEntries.length > 0) {
                formatted += `⚙️ **Engines:** ${engineEntries
                    .map(([key, value]) => `${key} ${value}`)
                    .join(', ')}\n\n`;
            }
        }

        if (packageInfo.main) {
            formatted += `📁 **Main:** \`${packageInfo.main}\`\n\n`;
        }

        if (packageInfo.types || packageInfo.typings) {
            formatted += `📝 **Types:** \`${packageInfo.types || packageInfo.typings}\`\n\n`;
        }

        return formatted;
    }
}
