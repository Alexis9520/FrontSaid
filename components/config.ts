// Archivo para centralizar la base URL y el helper apiUrl
export const BASE_URL = "";

export function apiUrl(path: string) {
  if (path.startsWith("http")) return path;
  return `${BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}


//export const BASE_URL = "http://109.199.106.139:8080";

//export function apiUrl(path: string) {
  //if (path.startsWith("http")) return path;
  //return `${BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
//}

