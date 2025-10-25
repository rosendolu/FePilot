import { NpmPackageInfo as NpmPackageInfoType } from '../services/npmApiService';

export interface IPackage {
    name: string;
    version: string;
    description: string;
    keywords: string[];
    date: string;
    links: Links;
    publisher: Publisher;
    maintainers: Publisher[];
}

interface Publisher {
    username: string;
    email: string;
}

interface Links {
    npm: string;
    homepage: string;
    repository: string;
    bugs: string;
}
export type NpmPackageInfo = NpmPackageInfoType;

interface Scripts {}

interface Repository {
    type: string;
    url: string;
    directory: string;
}

interface Contributor {
    name: string;
    url: string;
    githubUsername?: string;
}
