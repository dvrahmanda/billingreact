const axios=require('axios');
async function sendWhatsApp(target,message){
 if(!process.env.WHATSAPP_API_URL||!process.env.WHATSAPP_API_TOKEN) return {demo:true,target,message};
 return (await axios.post(process.env.WHATSAPP_API_URL,{target,message},{headers:{Authorization:`Bearer ${process.env.WHATSAPP_API_TOKEN}`}})).data;
}
module.exports={sendWhatsApp};
