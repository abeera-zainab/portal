const fs = require('fs');
const path = require('path');

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);
  
  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    if (fs.statSync(filePath).isDirectory()) {
      arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
    } else if (filePath.match(/\.(ts|tsx)$/)) {
      arrayOfFiles.push(filePath);
    }
  });
  
  return arrayOfFiles;
}

function fixImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  
  // Fix all broken import paths
  content = content.replace(/from ["']\.\.ui\//g, 'from "../ui/');
  content = content.replace(/from ["']\.\.\.ui\//g, 'from "../../ui/');
  content = content.replace(/from ["']\.\.\/\.\.\/libsalary["']/g, 'from "../../lib/salary"');
  content = content.replace(/from ["']\.\.\/\.\.\/\.\.\/libsalary["']/g, 'from "../../../lib/salary"');
  content = content.replace(/from ["']\.\.\/\.\.\/libfirestore["']/g, 'from "../../lib/firestore"');
  content = content.replace(/from ["']\.\.\/\.\.\/\.\.\/libfirestore["']/g, 'from "../../../lib/firestore"');
  content = content.replace(/from ["']\.\.\/\.\.\/libholidays["']/g, 'from "../../lib/holidays"');
  content = content.replace(/from ["']\.\.\/\.\.\/\.\.\/libholidays["']/g, 'from "../../../lib/holidays"');
  
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed: ${path.relative(__dirname, filePath)}`);
    return true;
  }
  return false;
}

const srcPath = path.join(__dirname, 'src');
const files = getAllFiles(srcPath);
let count = 0;

files.forEach(file => {
  if (fixImports(file)) {
    count++;
  }
});

console.log(`\nTotal files fixed: ${count}`);
