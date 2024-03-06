import { useState } from 'react'
import './App.css'
import "@chatscope/chat-ui-kit-styles/dist/default/styles.min.css";
import { MainContainer, ChatContainer, MessageList, Message, MessageInput, TypingIndicator } from '@chatscope/chat-ui-kit-react';
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import {output_parser} from 'langchain/schema/output_parser'
/*import {combineDocuments} from './CombineDocuments.js'*/
import {RunnableSequence, RunnablePasstrough} from 'langchain/schema/runnable'
import {createClient} from '@supabase/supabase-js'
import {SupabaseVectorStore} from 'langchain/vectorstores/supabase'



const systemMessage = { 
  role: "system", content: "Kısa öz bilgiler vermeni istiyorum"
};
const openaiApi=process.env.OPEN_AI_API;

 const promptTemp = new ChatPromptTemplate({ openai: llm });
 const sbApiKey= process.env.SB_API;
 const sbpUrl= process.env.SB_URL;
 const embeddings = new OpenAIEmbeddings({ apiKey: openaiApi });

const client = createClient(sbpUrl,sbApiKey);
 const vectorStore= new SupabaseVectorStore(embeddings,
  {
client,
tableName: "documents",
queryName: "match_documents"

  })
  const retriever= vectorStore.asRetriever();


  const llm = new ChatOpenAI({ apiKey: openaiApi });

 const prompt= ChatPromptTemplate.FromTemplate(`Answer the following question based only on the provided context:

 <context>
 {context}
 </context>
 
 Question: {input}`);
const promptChain = prompt.pipe(llm);
const response = await promptChain.invoke({context:"",input:"What is the capital of Turkey?"});
console.log(response.context);
function App() {
  const [messages, setMessages] = useState([
    {
      message: "Size nasıl yardımcı olabilirim ?",
      sentTime: "just now",
      sender: "ChatGPT"
    }
  ])
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = async (message) => {
    const newMessage = {
      message,
      direction: 'outgoing',
      sender: "user"
    };
    

    const newMessages = [...messages, newMessage];
    
    setMessages(newMessages);
   
     const retrievalChain = vectorStore.retrievalChain();


    /* Soruyu verimli bir prompt haline getirmek için bunu kullanabiliriz*/
  const standAloneQuestionTemplate= " verilen bir soruyu bağımsız bir soruya dönüştürün  soru : {input}  Bağımsız soru :";
  const  standAloneQuestionPrompt= ChatPromptTemplate.FromTemplate(standAloneQuestionTemplate);
  const  Chain = standAloneQuestionPrompt.pipe(llm).pipe(new output_parser()).pipe(retrievalChain);
  const result= Chain.invoke({input:message});
  
  console.log(result.context);
  const answerTemplate='Sen insanlara yardım etmek konusunda hevesli bir asistan botusun. Verilen döküman üzerinden insanlara uygun cevapları bulmaya çalışmalısın. Eğer yeterli cevabı bulamadıysdan "Yeterli bilgi bulamadım lütfen mahmud.eyavuz@gmail.com ile iletişime geçin." diyebilirsin. cevap uydurmyayı deneme. Her zaman bir dostunla konuşuyormuşçasına konuşmayı unutma. döküman: {context} soru: {input} answer:';
  
  
  
  const answerPrompt= ChatPromptTemplate.FromTemplate(answerTemplate);

   const standAloneQuestionChain =standAloneQuestionPrompt.pipe(llm).pipe(new output_parser());
   const retrieverChain=RunnableSequence.from([
    prevResult=> prevResult.standalone_question,
    retriever,
   //combineDocuments
   ])
   const answerChain= answerPrompt.pipe(llm).pipe(new output_parser())

   const chain=RunnableSequence.from([{
    standalone_question: standAloneQuestionChain,
   original_input: new RunnablePasstrough (),
  },
  {context: retrieverChain,
  question :({original_input})=> original_input.question},
  answerChain

   ])
    setIsTyping(true);
    await processMessageToChatGPT(newMessages);
  };

  async function processMessageToChatGPT(chatMessages) { 
    let apiMessages = chatMessages.map((messageObject) => {
      let role = "";
      if (messageObject.sender === "ChatGPT") {
        role = "assistant";
      } else {
        role = "user";
      }
      return { role: role, content: messageObject.message}
    });
    prompt.replace("{input}", apiMessages);
    

    

    
    const apiRequestBody = {
      "model": "gpt-3.5-turbo",
      "messages": [
        systemMessage,  // The system message DEFINES the logic of our chatGPT
        ...prompt // The messages from our chat with ChatGPT
      ]
    }

    await fetch("https://api.openai.com/v1/chat/completions", 
    {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(apiRequestBody)
    }).then((data) => {
      return data.json();
    }).then((data) => {
      console.log(data);
      setMessages([...chatMessages, {
        message: data.choices[0].message.content,
        sender: "ChatGPT"
      }]);
      setIsTyping(false);
    });
  }

  return (
    <div className="App">
      <div style={{ position:"relative", height: "800px", width: "700px"  }}>
        <MainContainer>
          <ChatContainer>       
            <MessageList 
              scrollBehavior="smooth" 
              typingIndicator={isTyping ? <TypingIndicator content="Yazıyor.." /> : null}
            >
              {messages.map((message, i) => {
                console.log(message)
                return <Message key={i} model={message} />
              })}
            </MessageList>
            <MessageInput placeholder="Mesaj giriniz" onSend={handleSend} />        
          </ChatContainer>
        </MainContainer>
      </div>
    </div>
  )
}

export default App