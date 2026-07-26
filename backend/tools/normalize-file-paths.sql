UPDATE documents
SET file_path = regexp_replace(
  replace(file_path, '\', '/'),
  '^.*\/storage\/',
  ''
)
WHERE replace(file_path, '\', '/') ~ '.*/storage/.+';

SELECT id, file_path
FROM documents
WHERE id >= 37
ORDER BY id;
