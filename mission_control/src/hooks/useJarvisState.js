import { useState } from "react";

export default function useJarvisState(){

const [state,setState] = useState("idle");


return {

state,

setState

};

}
