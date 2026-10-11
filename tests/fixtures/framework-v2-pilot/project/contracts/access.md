# Access Release 1

Call `authorize({actorId, projectId, action: "export"})` for every selected project
before reading its quotations or writing export output. A selection containing a
denied project fails as a whole without partial output. Do not silently omit rows
or turn access denial into empty success. Access is checked again on a later export;
the creator's earlier permission does not grant another actor access.
