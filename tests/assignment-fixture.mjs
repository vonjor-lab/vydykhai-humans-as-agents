export function assignment(v, event = v.authority, epoch = "epoch") {
  return {work:v.work, owner:v.owner, revision:v.revision, contextEpoch:epoch,
    evidence:"current-state-original", humanEvent:event,
    directions:[{id:event, source:"original-human-message", orderSource:"source-thread",
      sequence:2, work:v.work, kind:"AUTHORIZE", supersedes:null}],
    readback:{humanEvent:event, revision:v.revision, contextEpoch:epoch, evidence:"current-readback"},
    obligations:[]};
}
