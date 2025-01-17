import {
  BaseProviderAPI,
  BaseProviderAPICommitAction,
  BaseProviderAPITreeFile,
} from "@react-admin-git-provider/common";
import Ky from "ky";
import flatten from "lodash/flatten";
import querystring from "querystring";
import { getToken } from "./authProvider";

export interface GitlabOptions {
  host?: string;
  timeout?: number;
  version?: string;
  oauthToken?: string;
  treePerPage?: number;
}

const defaultOptions: GitlabOptions = {
  host: "https://gitlab.com",
  timeout: 30000,
  version: "v4",
};

interface GitlabFile {
  file_name: string;
  file_path: string;
  size: number;
  encoding: "base64";
  content_sha256: string;
  ref: string;
  blob_id: string;
  commit_id: string;
  last_commit_id: string;
  content: string;
}

interface GitlabCommitAction {
  action: "create" | "delete" | "move" | "update";
  file_path: string;
  content?: string;
}

interface GitlabCommitBody {
  actions: GitlabCommitAction[];
  branch: string;
  commit_message: string;
}

export function getGitlabUrl({ host, version }: GitlabOptions) {
  return [
    host || defaultOptions.host,
    "api",
    version || defaultOptions.version,
  ].join("/");
}

export function getGitlabHeaders({ oauthToken }: GitlabOptions) {
  return {
    authorization: `Bearer ${oauthToken || getToken()}`,
  };
}

export class GitlabProviderAPI extends BaseProviderAPI {
  private readonly url: string;
  private readonly headers: { [header: string]: string };
  private readonly timeout?: number;
  private readonly treePerPage: number = 10;

  constructor(options: GitlabOptions) {
    super();
    this.url = getGitlabUrl(options);
    this.headers = getGitlabHeaders(options);
    this.timeout = options.timeout;
  }

  public async tree(projectId: string, ref: string, path: string) {
    const { headers, records } = await this._fetchTree(projectId, ref, path, 1);
    const totalPage = parseInt(headers.get("X-Total-Pages") || "", 10) || 0;
    const pages = totalPage > 0 ? Array(totalPage - 1).fill(0) : [];
    const nextRecords = flatten(
      await Promise.all(
        pages.map(async (z, page) => {
          const { records: r } = await this._fetchTree(
            projectId,
            ref,
            path,
            page + 2,
          );
          return r;
        }),
      ),
    );

    return [...records, ...nextRecords];
  }

  public async showFile(projectId: string, ref: string, path: string) {
    const response = await Ky.get(
      this.url +
        "/" +
        "projects/" +
        encodeURIComponent(projectId) +
        "/repository/files/" +
        encodeURIComponent(path) +
        "?" +
        querystring.stringify({
          ref,
        }),
      {
        headers: this.headers,
        timeout: this.timeout,
      },
    );
    const body: GitlabFile = await response.json();
    return {
      blobId: body.blob_id,
      content: body.content,
      encoding: body.encoding,
      filePath: body.file_path,
    };
  }

  public async commit(
    projectId: string,
    ref: string,
    message: string,
    actions: BaseProviderAPICommitAction[],
  ) {
    const commitBody: GitlabCommitBody = {
      actions: actions.map(({ action, filePath, content }) => ({
        action,
        content,
        file_path: filePath,
      })),
      branch: ref,
      commit_message: message,
    };

    await Ky.post(
      this.url +
        "/" +
        "projects/" +
        encodeURIComponent(projectId) +
        "/repository/commits",
      {
        headers: this.headers,
        json: commitBody,
        timeout: this.timeout,
      },
    );
  }

  private async _fetchTree(
    projectId: string,
    ref: string,
    path: string,
    page: number,
  ) {
    const response = Ky.get(
      this.url +
        "/" +
        "projects/" +
        encodeURIComponent(projectId) +
        "/repository/tree?" +
        querystring.stringify({
          page,
          path,
          per_page: this.treePerPage,
          ref,
        }),
      {
        headers: this.headers,
        timeout: this.timeout,
      },
    );
    const { headers } = await response;
    const records: BaseProviderAPITreeFile[] = await response.json();

    return { headers, records };
  }
}
