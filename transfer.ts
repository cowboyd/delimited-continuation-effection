import { Children, Parent } from "./contexts.ts";
import { TaskGroup } from "./task-group.ts";
import type { Scope } from "./types.ts";

export interface Transfer {
  from: Scope;
  to: Scope;
}

export function transfer({ from, to }: Transfer): void {
  TaskGroup.transfer(from, to);

  let toChildren = to.expect(Children);
  let fromChildren = from.expect(Children);

  for (let [child, destructor] of fromChildren) {    
    fromChildren.delete(child);
    child.set(Parent, to);
    toChildren.set(child, destructor);
    //@ts-expect-error this should be a cast();
    Object.setPrototypeOf(child.contexts, to.contexts);
  }

  
}

/*
 * scope global
 *  - scope main
 *  -   scoped race
 *  -     contestant 1
 *          - res 1
 *          - res 2
 *  -     contestant 2


contestant 1 will go away, but res 1 and res 2 should become children of main
/ res1 has as its new parent, main
 */

// race test
//  - preserves context sets in the winner, but not losers
//  - preserves resources in the winner, but not losers.
