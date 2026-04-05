// src/define_config.ts
function defineConfig(config) {
  return {
    allowedMethods: config.allowedMethods || ["POST", "PUT", "PATCH", "DELETE"],
    form: {
      encoding: "utf-8",
      limit: "1mb",
      queryString: {},
      types: ["application/x-www-form-urlencoded"],
      convertEmptyStringsToNull: true,
      ...config.form
    },
    json: {
      encoding: "utf-8",
      limit: "1mb",
      strict: true,
      types: [
        "application/json",
        "application/json-patch+json",
        "application/vnd.api+json",
        "application/csp-report"
      ],
      convertEmptyStringsToNull: true,
      ...config.json
    },
    raw: {
      encoding: "utf-8",
      limit: "1mb",
      types: ["text/*"],
      ...config.raw
    },
    multipart: {
      autoProcess: true,
      processManually: [],
      encoding: "utf-8",
      maxFields: 1e3,
      limit: "20mb",
      types: ["multipart/form-data"],
      convertEmptyStringsToNull: true,
      ...config.multipart
    }
  };
}

export {
  defineConfig
};
