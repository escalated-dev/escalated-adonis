// src/schema/helpers.ts
var BOOLEAN_POSITIVES = ["1", 1, "true", true];
var BOOLEAN_NEGATIVES = ["0", 0, "false", false];
function ensureExists(key, value, message) {
  if (!value) {
    throw new Error(message || `Missing environment variable "${key}"`);
  }
}

// src/schema/one_of.ts
function ensureOneOf(choices, key, value, message) {
  if (BOOLEAN_NEGATIVES.includes(value)) {
    value = false;
  } else if (BOOLEAN_POSITIVES.includes(value)) {
    value = true;
  } else {
    const toNumber = Number(value);
    if (!Number.isNaN(toNumber)) {
      value = toNumber;
    }
  }
  if (choices.includes(value)) {
    return value;
  }
  throw new Error(
    message || `"${key}" env variable must be one of "${choices.join(",")}" (Current value: "${value}")`
  );
}
function oneOf(choices, options) {
  return function validate(key, value) {
    ensureExists(key, value, options?.message);
    return ensureOneOf(choices, key, value, options?.message);
  };
}
oneOf.optional = function optionalEnum(choices, options) {
  return function validate(key, value) {
    if (!value) {
      return void 0;
    }
    return ensureOneOf(choices, key, value, options?.message);
  };
};
oneOf.optionalWhen = function optionalWhenEnum(condition, choices, options) {
  return function validate(key, value) {
    if (typeof condition === "function" ? condition(key, value) : condition) {
      return oneOf.optional(choices, options)(key, value);
    }
    return oneOf(choices, options)(key, value);
  };
};

// src/schema/number.ts
function castToNumber(key, value, message) {
  const castedValue = Number(value);
  if (Number.isNaN(castedValue)) {
    throw new Error(message || `"${key}" env variable must be a number (Current value: "${value}")`);
  }
  return castedValue;
}
function number(options) {
  return function validate(key, value) {
    ensureExists(key, value, options?.message);
    return castToNumber(key, value, options?.message);
  };
}
number.optional = function optionalNumber(options) {
  return function validate(key, value) {
    if (!value) {
      return void 0;
    }
    return castToNumber(key, value, options?.message);
  };
};
number.optionalWhen = function optionalWhenNumber(condition, options) {
  return function validate(key, value) {
    if (typeof condition === "function" ? condition(key, value) : condition) {
      return number.optional(options)(key, value);
    }
    return number(options)(key, value);
  };
};

// src/validator.ts
var splitNameAddress = /^([^\x00-\x1F\x7F-\x9F\cX]+)</i;
var emailUserPart = /^[a-z\d!#\$%&'\*\+\-\/=\?\^_`{\|}~]+$/i;
var quotedEmailUser = /^([\s\x01-\x08\x0b\x0c\x0e-\x1f\x7f\x21\x23-\x5b\x5d-\x7e]|(\\[\x01-\x09\x0b\x0c\x0d-\x7f]))*$/i;
var emailUserUtf8Part = /^[a-z\d!#\$%&'\*\+\-\/=\?\^_`{\|}~\u00A1-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]+$/i;
var quotedEmailUserUtf8 = /^([\s\x01-\x08\x0b\x0c\x0e-\x1f\x7f\x21\x23-\x5b\x5d-\x7e\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]|(\\[\x01-\x09\x0b\x0c\x0d-\x7f\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))*$/i;
var defaultMaxEmailLength = 254;
var IPv4SegmentFormat = "(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])";
var IPv4AddressFormat = `(${IPv4SegmentFormat}[.]){3}${IPv4SegmentFormat}`;
var IPv4AddressRegExp = new RegExp(`^${IPv4AddressFormat}$`);
var IPv6SegmentFormat = "(?:[0-9a-fA-F]{1,4})";
var IPv6AddressRegExp = new RegExp(
  `^((?:${IPv6SegmentFormat}:){7}(?:${IPv6SegmentFormat}|:)|(?:${IPv6SegmentFormat}:){6}(?:${IPv4AddressFormat}|:${IPv6SegmentFormat}|:)|(?:${IPv6SegmentFormat}:){5}(?::${IPv4AddressFormat}|(:${IPv6SegmentFormat}){1,2}|:)|(?:${IPv6SegmentFormat}:){4}(?:(:${IPv6SegmentFormat}){0,1}:${IPv4AddressFormat}|(:${IPv6SegmentFormat}){1,3}|:)|(?:${IPv6SegmentFormat}:){3}(?:(:${IPv6SegmentFormat}){0,2}:${IPv4AddressFormat}|(:${IPv6SegmentFormat}){1,4}|:)|(?:${IPv6SegmentFormat}:){2}(?:(:${IPv6SegmentFormat}){0,3}:${IPv4AddressFormat}|(:${IPv6SegmentFormat}){1,5}|:)|(?:${IPv6SegmentFormat}:){1}(?:(:${IPv6SegmentFormat}){0,4}:${IPv4AddressFormat}|(:${IPv6SegmentFormat}){1,6}|:)|(?::((?::${IPv6SegmentFormat}){0,5}:${IPv4AddressFormat}|(?::${IPv6SegmentFormat}){1,7}|:)))(%[0-9a-zA-Z-.:]{1,})?$`
);
var WRAPPED_IPV6 = /^\[([^\]]+)\](?::([0-9]+))?$/;
function validateDisplayName(displayName) {
  const displayNameWithoutQuotes = displayName.replace(/^"(.+)"$/, "$1");
  if (!displayNameWithoutQuotes.trim()) {
    return false;
  }
  const containsIllegal = /[\.";<>]/.test(displayNameWithoutQuotes);
  if (containsIllegal) {
    if (displayNameWithoutQuotes === displayName) {
      return false;
    }
    const allStartWithBackSlash = displayNameWithoutQuotes.split('"').length === displayNameWithoutQuotes.split('\\"').length;
    if (!allStartWithBackSlash) {
      return false;
    }
  }
  return true;
}
function isIP(str, version) {
  if (version === 4) {
    return IPv4AddressRegExp.test(str);
  } else if (version === 6) {
    return IPv6AddressRegExp.test(str);
  }
  return isIP(str, 4) || isIP(str, 6);
}
function isFQDN(str, options) {
  options = Object.assign(
    {
      require_tld: true,
      allow_underscores: false,
      allow_trailing_dot: false,
      allow_numeric_tld: false,
      allow_wildcard: false,
      ignore_max_length: false
    },
    options
  );
  if (options.allow_trailing_dot && str[str.length - 1] === ".") {
    str = str.substring(0, str.length - 1);
  }
  if (options.allow_wildcard === true && str.indexOf("*.") === 0) {
    str = str.substring(2);
  }
  const parts = str.split(".");
  const tld = parts[parts.length - 1];
  if (options.require_tld) {
    if (parts.length < 2) {
      return false;
    }
    if (!options.allow_numeric_tld && !/^([a-z\u00A1-\u00A8\u00AA-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]{2,}|xn[a-z0-9-]{2,})$/i.test(
      tld
    )) {
      return false;
    }
    if (/\s/.test(tld)) {
      return false;
    }
  }
  if (!options.allow_numeric_tld && /^\d+$/.test(tld)) {
    return false;
  }
  return parts.every((part) => {
    if (part.length > 63 && !options.ignore_max_length) {
      return false;
    }
    if (!/^[a-z_\u00a1-\uffff0-9-]+$/i.test(part)) {
      return false;
    }
    if (/[\uff01-\uff5e]/.test(part)) {
      return false;
    }
    if (/^-|-$/.test(part)) {
      return false;
    }
    if (!options.allow_underscores && /_/.test(part)) {
      return false;
    }
    return true;
  });
}
function isURL(url, options) {
  if (!url || /[\s<>]/.test(url)) {
    return false;
  }
  if (url.indexOf("mailto:") === 0) {
    return false;
  }
  const normalizedOptions = Object.assign(
    {
      protocols: ["http", "https", "ftp"],
      require_tld: true,
      require_protocol: false,
      require_host: true,
      require_port: false,
      require_valid_protocol: true,
      allow_underscores: false,
      allow_trailing_dot: false,
      allow_protocol_relative_urls: false,
      allow_fragments: true,
      allow_query_components: true,
      validate_length: true,
      max_allowed_length: 2084
    },
    options
  );
  if (normalizedOptions.validate_length && url.length > normalizedOptions.max_allowed_length) {
    return false;
  }
  if (!normalizedOptions.allow_fragments && url.includes("#")) {
    return false;
  }
  if (!normalizedOptions.allow_query_components && (url.includes("?") || url.includes("&"))) {
    return false;
  }
  let protocol;
  let auth;
  let host;
  let hostname;
  let port;
  let portStr;
  let ipv6;
  let split = url.split("#");
  url = split.shift();
  split = url.split("?");
  url = split.shift();
  split = url.split("://");
  if (split.length > 1) {
    protocol = split.shift().toLowerCase();
    if (normalizedOptions.require_valid_protocol && normalizedOptions.protocols.indexOf(protocol) === -1) {
      return false;
    }
  } else if (normalizedOptions.require_protocol) {
    return false;
  } else if (url.slice(0, 2) === "//") {
    if (!normalizedOptions.allow_protocol_relative_urls) {
      return false;
    }
    split[0] = url.slice(2);
  }
  url = split.join("://");
  if (url === "") {
    return false;
  }
  split = url.split("/");
  url = split.shift();
  if (url === "" && !normalizedOptions.require_host) {
    return true;
  }
  split = url.split("@");
  if (split.length > 1) {
    if (normalizedOptions.disallow_auth) {
      return false;
    }
    if (split[0] === "") {
      return false;
    }
    auth = split.shift();
    if (auth.indexOf(":") >= 0 && auth.split(":").length > 2) {
      return false;
    }
    const [user, password] = auth.split(":");
    if (user === "" && password === "") {
      return false;
    }
  }
  hostname = split.join("@");
  portStr = null;
  ipv6 = null;
  const ipv6Match = hostname.match(WRAPPED_IPV6);
  if (ipv6Match) {
    host = "";
    ipv6 = ipv6Match[1];
    portStr = ipv6Match[2] || null;
  } else {
    split = hostname.split(":");
    host = split.shift();
    if (split.length) {
      portStr = split.join(":");
    }
  }
  if (portStr !== null && portStr.length > 0) {
    port = Number.parseInt(portStr, 10);
    if (!/^[0-9]+$/.test(portStr) || port <= 0 || port > 65535) {
      return false;
    }
  } else if (normalizedOptions.require_port) {
    return false;
  }
  if (host === "" && !normalizedOptions.require_host) {
    return true;
  }
  if (!isIP(host) && !isFQDN(host, options) && (!ipv6 || !isIP(ipv6, 6))) {
    return false;
  }
  host = host || ipv6;
  return true;
}
function isEmail(str, options) {
  options = Object.assign(
    {
      allow_display_name: false,
      allow_underscores: false,
      require_display_name: false,
      allow_utf8_local_part: true,
      ignore_max_length: false,
      require_tld: true
    },
    options
  );
  if (options.require_display_name || options.allow_display_name) {
    const displayEmail = str.match(splitNameAddress);
    if (displayEmail) {
      let displayName = displayEmail[1];
      str = str.replace(displayName, "").replace(/(^<|>$)/g, "");
      if (displayName.endsWith(" ")) {
        displayName = displayName.slice(0, -1);
      }
      if (!validateDisplayName(displayName)) {
        return false;
      }
    } else if (options.require_display_name) {
      return false;
    }
  }
  if (!options.ignore_max_length && str.length > defaultMaxEmailLength) {
    return false;
  }
  const parts = str.split("@");
  const domain = parts.pop();
  let user = parts.join("@");
  if (!isFQDN(domain, {
    require_tld: options.require_tld,
    allow_underscores: options.allow_underscores
  })) {
    if (!isIP(domain)) {
      if (!domain.startsWith("[") || !domain.endsWith("]")) {
        return false;
      }
      let noBracketdomain = domain.slice(1, -1);
      if (noBracketdomain.length === 0 || !isIP(noBracketdomain)) {
        return false;
      }
    }
  }
  if (user[0] === '"' && user[user.length - 1] === '"') {
    user = user.slice(1, user.length - 1);
    return options.allow_utf8_local_part ? quotedEmailUserUtf8.test(user) : quotedEmailUser.test(user);
  }
  const pattern = options.allow_utf8_local_part ? emailUserUtf8Part : emailUserPart;
  const userParts = user.split(".");
  for (const userPart of userParts) {
    if (!pattern.test(userPart)) {
      return false;
    }
  }
  return true;
}
function isUUID(str) {
  return /^[0-9A-F]{8}-[0-9A-F]{4}-\d[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i.test(str);
}

// src/schema/string.ts
var formats = {
  email: (key, value, options) => {
    if (!isEmail(value)) {
      throw new Error(
        options.message || `Value for environment variable "${key}" must be a valid email, instead received "${value}"`
      );
    }
  },
  host: (key, value, options) => {
    if (!isFQDN(value, { require_tld: false }) && !isIP(value)) {
      throw new Error(
        options.message || `Value for environment variable "${key}" must be a valid (domain or ip), instead received "${value}"`
      );
    }
  },
  url: (key, value, options) => {
    const { tld, protocol } = Object.assign(
      {
        tld: true,
        protocol: true
      },
      options
    );
    if (!isURL(value, { require_tld: tld, require_protocol: protocol })) {
      throw new Error(
        options.message || `Value for environment variable "${key}" must be a valid URL, instead received "${value}"`
      );
    }
  },
  uuid: (key, value, options) => {
    if (!isUUID(value)) {
      throw new Error(
        options.message || `Value for environment variable "${key}" must be a valid UUID, instead received "${value}"`
      );
    }
  }
};
function string(options) {
  return function validate(key, value) {
    ensureExists(key, value, options?.message);
    if (options?.format) {
      formats[options.format](key, value, options);
    }
    return value;
  };
}
string.optional = function optionalString(options) {
  return function validate(key, value) {
    if (!value) {
      return void 0;
    }
    if (options?.format) {
      formats[options.format](key, value, options);
    }
    return value;
  };
};
string.optionalWhen = function optionalWhenString(condition, options) {
  return function validate(key, value) {
    if (typeof condition === "function" ? condition(key, value) : condition) {
      return string.optional(options)(key, value);
    }
    return string(options)(key, value);
  };
};

// src/schema/boolean.ts
function castToBoolean(key, value, message) {
  if (BOOLEAN_POSITIVES.includes(value)) {
    return true;
  }
  if (BOOLEAN_NEGATIVES.includes(value)) {
    return false;
  }
  throw new Error(message || `"${key}" env variable must be a boolean (Current value: "${value}")`);
}
function boolean(options) {
  return function validate(key, value) {
    ensureExists(key, value, options?.message);
    return castToBoolean(key, value, options?.message);
  };
}
boolean.optional = function optionalBoolean(options) {
  return function validate(key, value) {
    if (!value) {
      return void 0;
    }
    return castToBoolean(key, value, options?.message);
  };
};
boolean.optionalWhen = function optionalWhenBoolean(condition, options) {
  return function validate(key, value) {
    if (typeof condition === "function" ? condition(key, value) : condition) {
      return boolean.optional(options)(key, value);
    }
    return boolean(options)(key, value);
  };
};

// src/schema/main.ts
var schema = {
  number,
  string,
  boolean,
  enum: oneOf
};
export {
  schema
};
