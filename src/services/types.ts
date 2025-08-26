export interface Credentials {
  email: string;
  password: string;
}
export interface UserProfile {
  [key: string]: any;
  id: string;
  name?: string;
  email?: string;
  roles?: string[];
}
