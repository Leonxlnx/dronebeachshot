/** A failed graphics session is terminal until the page reloads. */
export function createSceneReadiness(contextLost:()=>boolean){
 let loaded=false,failure:string|null=null;
 function assertAvailable(){
  if(contextLost()&&!failure)failure='The graphics context was lost';
  if(failure)throw new Error(failure);
 }
 function assertReady(){
  assertAvailable();
  if(!loaded)throw new Error('The scene is not ready for capture');
 }
 return {
  get ready(){return loaded&&!failure&&!contextLost()},
  get error(){return failure},
  fail(message:string){failure??=message;loaded=false},
  markReady(){assertAvailable();loaded=true},
  assertAvailable,
  assertReady,
 };
}
