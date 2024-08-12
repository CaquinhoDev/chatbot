const axios = require("axios");
const FormData = require("form-data");

async function getSimSimiResponse(query) {
  let data = new FormData();
  data.append("lc", "pt");
  data.append("key", ""); // Substitua esse vazio pela sua chave da API SimSimi caso seja necessário!
  data.append("text", query);

  let config = {
    method: "post",
    url: "https://api.simsimi.vn/v1/simtalk",
    headers: {
      ...data.getHeaders(),
    },
    data: data,
  };

  try {
    const response = await axios.request(config);

    // Verifica se o status é diferente de 200
    if (response.status !== 200) {
      console.error("Error:", response.statusText);
    }

    //console.log(JSON.stringify(response.data)); // Exibir a resposta completa da API

    // Verifica se a resposta contém a mensagem
    if (
      response.data &&
      response.data.message &&
      response.data.message !== ""
    ) {
      return response.data.message;
    } else {
      console.error("Error: No valid response message found.");
      return "Desculpe, não consegui entender sua mensagem."; // Mensagem padrão caso não encontre uma resposta válida
    }
  } catch (error) {
    // Verifica se o erro contém uma resposta com uma mensagem
    if (error.response && error.response.data && error.response.data.message) {
      console.log(JSON.stringify(error.response.data)); // Exibir a resposta de erro completa da API
      return error.response.data.message;
    }

    console.error("Error:", error);
    return "Desculpe, houve um erro ao processar sua mensagem."; // Mensagem padrão para outros erros
  }
}

module.exports = getSimSimiResponse;
