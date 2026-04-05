// src/multipart/file.ts
import { join } from "path";
import crypto from "crypto";
import { Exception } from "@poppinss/utils";
import Macroable from "@poppinss/macroable";

// src/helpers.ts
import mediaTyper from "media-typer";
import { dirname, extname } from "path";
import { RuntimeException } from "@poppinss/utils";
import { fileTypeFromBuffer, supportedExtensions } from "file-type";
import { access, mkdir, copyFile, unlink, rename } from "fs/promises";
var supportMagicFileTypes = supportedExtensions;
function parseMimeType(mime) {
  try {
    const { type, subtype } = mediaTyper.parse(mime);
    return { type, subtype };
  } catch (error) {
    return null;
  }
}
async function getFileType(fileContents) {
  const magicType = await fileTypeFromBuffer(fileContents);
  if (magicType) {
    return Object.assign({ ext: magicType.ext }, parseMimeType(magicType.mime));
  }
  return null;
}
function computeFileTypeFromName(clientName, headers) {
  return Object.assign(
    { ext: extname(clientName).replace(/^\./, "") },
    parseMimeType(headers["content-type"])
  );
}
async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
async function moveFile(sourcePath, destinationPath, options = { overwrite: true }) {
  if (!sourcePath || !destinationPath) {
    throw new RuntimeException('"sourcePath" and "destinationPath" required');
  }
  if (!options.overwrite && await pathExists(destinationPath)) {
    throw new RuntimeException(`The destination file already exists: "${destinationPath}"`);
  }
  await mkdir(dirname(destinationPath), {
    recursive: true,
    mode: options.directoryMode
  });
  try {
    await rename(sourcePath, destinationPath);
  } catch (error) {
    if (error.code === "EXDEV") {
      await copyFile(sourcePath, destinationPath);
      await unlink(sourcePath);
    } else {
      throw error;
    }
  }
}

// src/multipart/validators/size.ts
import bytes from "bytes";
var SizeValidator = class {
  #file;
  #maximumAllowedLimit;
  #bytesLimit = 0;
  validated = false;
  /**
   * Defining the maximum bytes the file can have
   */
  get maxLimit() {
    return this.#maximumAllowedLimit;
  }
  set maxLimit(limit) {
    if (this.#maximumAllowedLimit !== void 0) {
      throw new Error("Cannot reset sizeLimit after file has been validated");
    }
    this.validated = false;
    this.#maximumAllowedLimit = limit;
    if (this.#maximumAllowedLimit) {
      this.#bytesLimit = typeof this.#maximumAllowedLimit === "string" ? bytes(this.#maximumAllowedLimit) : this.#maximumAllowedLimit;
    }
  }
  constructor(file) {
    this.#file = file;
  }
  /**
   * Reporting error to the file
   */
  #reportError() {
    this.#file.errors.push({
      fieldName: this.#file.fieldName,
      clientName: this.#file.clientName,
      message: `File size should be less than ${bytes(this.#bytesLimit)}`,
      type: "size"
    });
  }
  /**
   * Validating file size while it is getting streamed. We only mark
   * the file as `validated` when it's validation fails. Otherwise
   * we keep re-validating the file as we receive more data.
   */
  #validateWhenGettingStreamed() {
    if (this.#file.size > this.#bytesLimit) {
      this.validated = true;
      this.#reportError();
    }
  }
  /**
   * We have the final file size after the stream has been consumed. At this
   * stage we always mark `validated = true`.
   */
  #validateAfterConsumed() {
    this.validated = true;
    if (this.#file.size > this.#bytesLimit) {
      this.#reportError();
    }
  }
  /**
   * Validate the file size
   */
  validate() {
    if (this.validated) {
      return;
    }
    if (this.#maximumAllowedLimit === void 0) {
      this.validated = true;
      return;
    }
    if (this.#file.state === "streaming") {
      this.#validateWhenGettingStreamed();
      return;
    }
    if (this.#file.state === "consumed") {
      this.#validateAfterConsumed();
      return;
    }
  }
};

// src/multipart/validators/extensions.ts
var ExtensionValidator = class {
  #file;
  #allowedExtensions = [];
  validated = false;
  /**
   * Update the expected file extensions
   */
  get extensions() {
    return this.#allowedExtensions;
  }
  set extensions(extnames) {
    if (this.#allowedExtensions && this.#allowedExtensions.length) {
      throw new Error("Cannot update allowed extension names after file has been validated");
    }
    this.validated = false;
    this.#allowedExtensions = extnames;
  }
  constructor(file) {
    this.#file = file;
  }
  /**
   * Report error to the file
   */
  #reportError() {
    const suffix = this.#allowedExtensions.length === 1 ? "is" : "are";
    const message = [
      `Invalid file extension ${this.#file.extname}.`,
      `Only ${this.#allowedExtensions.join(", ")} ${suffix} allowed`
    ].join(" ");
    this.#file.errors.push({
      fieldName: this.#file.fieldName,
      clientName: this.#file.clientName,
      message,
      type: "extname"
    });
  }
  /**
   * Validating the file in the streaming mode. During this mode
   * we defer the validation, until we get the file extname.
   */
  #validateWhenGettingStreamed() {
    if (!this.#file.extname) {
      return;
    }
    this.validated = true;
    if (this.#allowedExtensions.includes(this.#file.extname)) {
      return;
    }
    this.#reportError();
  }
  /**
   * Validate the file extension after it has been streamed
   */
  #validateAfterConsumed() {
    this.validated = true;
    if (this.#allowedExtensions.includes(this.#file.extname || "")) {
      return;
    }
    this.#reportError();
  }
  /**
   * Validate the file
   */
  validate() {
    if (this.validated) {
      return;
    }
    if (!Array.isArray(this.#allowedExtensions) || this.#allowedExtensions.length === 0) {
      this.validated = true;
      return;
    }
    if (this.#file.state === "streaming") {
      this.#validateWhenGettingStreamed();
      return;
    }
    if (this.#file.state === "consumed") {
      this.#validateAfterConsumed();
    }
  }
};

// src/multipart/file.ts
var MultipartFile = class extends Macroable {
  /**
   * File validators
   */
  #sizeValidator = new SizeValidator(this);
  #extensionValidator = new ExtensionValidator(this);
  /**
   * A boolean to know if file is an instance of this class
   * or not
   */
  isMultipartFile = true;
  /**
   * Field name is the name of the field
   */
  fieldName;
  /**
   * Client name is the file name on the user client
   */
  clientName;
  /**
   * The headers sent as part of the multipart request
   */
  headers;
  /**
   * File size in bytes
   */
  size = 0;
  /**
   * The extname for the file.
   */
  extname;
  /**
   * Upload errors
   */
  errors = [];
  /**
   * Type and subtype are extracted from the `content-type`
   * header or from the file magic number
   */
  type;
  subtype;
  /**
   * File path is only set after the move operation
   */
  filePath;
  /**
   * File name is only set after the move operation. It is the relative
   * path of the moved file
   */
  fileName;
  /**
   * Tmp path, only exists when file is uploaded using the
   * classic mode.
   */
  tmpPath;
  /**
   * The file meta data
   */
  meta = {};
  /**
   * The state of the file
   */
  state = "idle";
  /**
   * Whether or not the validations have been executed
   */
  get validated() {
    return this.#sizeValidator.validated && this.#extensionValidator.validated;
  }
  /**
   * A boolean to know if file has one or more errors
   */
  get isValid() {
    return this.errors.length === 0;
  }
  /**
   * Opposite of [[this.isValid]]
   */
  get hasErrors() {
    return !this.isValid;
  }
  /**
   * The maximum file size limit
   */
  get sizeLimit() {
    return this.#sizeValidator.maxLimit;
  }
  set sizeLimit(limit) {
    this.#sizeValidator.maxLimit = limit;
  }
  /**
   * Extensions allowed
   */
  get allowedExtensions() {
    return this.#extensionValidator.extensions;
  }
  set allowedExtensions(extensions) {
    this.#extensionValidator.extensions = extensions;
  }
  constructor(data, validationOptions) {
    super();
    this.sizeLimit = validationOptions.size;
    this.allowedExtensions = validationOptions.extnames;
    this.fieldName = data.fieldName;
    this.clientName = data.clientName;
    this.headers = data.headers;
  }
  /**
   * Validate the file
   */
  validate() {
    this.#extensionValidator.validate();
    this.#sizeValidator.validate();
  }
  /**
   * Mark file as moved
   */
  markAsMoved(fileName, filePath) {
    this.filePath = filePath;
    this.fileName = fileName;
    this.state = "moved";
  }
  /**
   * Moves the file to a given location. Multiple calls to the `move` method are allowed,
   * incase you want to move a file to multiple locations.
   */
  async move(location, options) {
    if (!this.tmpPath) {
      throw new Exception('property "tmpPath" must be set on the file before moving it', {
        status: 500,
        code: "E_MISSING_FILE_TMP_PATH"
      });
    }
    options = Object.assign(
      { name: `${crypto.randomUUID()}.${this.extname ?? "unknown"}`, overwrite: true },
      options
    );
    const filePath = join(location, options.name);
    try {
      await moveFile(this.tmpPath, filePath, { overwrite: options.overwrite });
      this.markAsMoved(options.name, filePath);
    } catch (error) {
      if (error.message.includes("destination file already")) {
        throw new Exception(
          `"${options.name}" already exists at "${location}". Set "overwrite = true" to overwrite it`
        );
      }
      throw error;
    }
  }
  /**
   * Returns file JSON representation
   */
  toJSON() {
    return {
      fieldName: this.fieldName,
      clientName: this.clientName,
      size: this.size,
      filePath: this.filePath,
      fileName: this.fileName,
      type: this.type,
      extname: this.extname,
      subtype: this.subtype,
      state: this.state,
      isValid: this.isValid,
      validated: this.validated,
      errors: this.errors,
      meta: this.meta
    };
  }
};

export {
  supportMagicFileTypes,
  getFileType,
  computeFileTypeFromName,
  MultipartFile
};
