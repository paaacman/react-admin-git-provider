import * as mod from "..";

describe("react-admin-gitlab", () => {
  test("export", () => {
    expect(Object.keys(mod)).toEqual([
      "gitlabAuth",
      "GitlabProviderBranch",
      "GitlabProviderCommit",
      "GitlabProviderFileList",
      "GitlabProviderPipeline",
      "createDataProvider",
    ]);
  });
});
