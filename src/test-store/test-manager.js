import { readdir, readFile, writeFile, unlink, stat, mkdir } from "fs/promises";
import path from "path";

// Tests directory is relative to current working directory
const TESTS_DIR = path.join(process.cwd(), "tests");

/**
 * Save a test script to the tests/ directory
 * @param {string} name - Test name (without .dcua extension)
 * @param {string} content - Test script content (one instruction per line)
 * @returns {Promise<string>} - Full path to saved file
 */
export async function saveTest(name, content) {
  // Ensure name doesn't have .dcua extension
  const cleanName = name.endsWith(".dcua") ? name.slice(0, -5) : name;
  const filename = `${cleanName}.dcua`;
  const filepath = path.join(TESTS_DIR, filename);

  // Create tests directory if it doesn't exist
  await mkdir(TESTS_DIR, { recursive: true });

  await writeFile(filepath, content, "utf-8");
  return filepath;
}

/**
 * Load a test script from the tests/ directory
 * @param {string} name - Test name (with or without .dcua extension)
 * @returns {Promise<string[]>} - Array of instructions (lines)
 */
export async function loadTest(name) {
  const filename = name.endsWith(".dcua") ? name : `${name}.dcua`;
  const filepath = path.join(TESTS_DIR, filename);

  const content = await readFile(filepath, "utf-8");
  return content
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

/**
 * Get the raw content of a test file
 * @param {string} name - Test name (with or without .dcua extension)
 * @returns {Promise<string>} - Raw file content
 */
export async function getTestContent(name) {
  const filename = name.endsWith(".dcua") ? name : `${name}.dcua`;
  const filepath = path.join(TESTS_DIR, filename);

  return await readFile(filepath, "utf-8");
}

/**
 * List all test files in the tests/ directory
 * @returns {Promise<Array<{name: string, path: string, lines: number, modified: Date}>>}
 */
export async function listTests() {
  // Return empty array if tests directory doesn't exist
  try {
    await stat(TESTS_DIR);
  } catch {
    return [];
  }

  const files = await readdir(TESTS_DIR);
  const dcuaFiles = files.filter(f => f.endsWith(".dcua"));

  const tests = await Promise.all(
    dcuaFiles.map(async (filename) => {
      const filepath = path.join(TESTS_DIR, filename);
      const stats = await stat(filepath);
      const content = await readFile(filepath, "utf-8");
      const lines = content.split("\n").filter(line => line.trim().length > 0).length;

      return {
        name: filename.replace(".dcua", ""),
        filename: filename,
        path: filepath,
        lines: lines,
        modified: stats.mtime,
      };
    })
  );

  // Sort by modified date (newest first)
  return tests.sort((a, b) => b.modified - a.modified);
}

/**
 * Delete a test file
 * @param {string} name - Test name (with or without .dcua extension)
 * @returns {Promise<void>}
 */
export async function deleteTest(name) {
  const filename = name.endsWith(".dcua") ? name : `${name}.dcua`;
  const filepath = path.join(TESTS_DIR, filename);

  await unlink(filepath);
}

/**
 * Check if a test exists
 * @param {string} name - Test name (with or without .dcua extension)
 * @returns {Promise<boolean>}
 */
export async function testExists(name) {
  const filename = name.endsWith(".dcua") ? name : `${name}.dcua`;
  const filepath = path.join(TESTS_DIR, filename);

  try {
    await stat(filepath);
    return true;
  } catch {
    return false;
  }
}
