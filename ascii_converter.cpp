#include <iostream>
#include <string>
#include <vector>
#include <exception>
#include <emscripten/bind.h>

// to stb_image.h
#define STB_IMAGE_IMPLEMENTATION
#include "stb_image.h"

using namespace emscripten;

// --- Constantes da Lógica Original ---
const std::string ASCII_CHARS =
    " `.-':_,^=;><+!rc*/z?sLTv)J7(|Fi{C}fI31tlu2ESwqkP6h9d4VpOGbUAKXHm8RD#$Bg0MNWQ%&@";
const unsigned int DEFAULT_WIDTH = 120;

// --- Função principal de conversão (Com Bloco try...catch e verificações) ---
std::string convertToASCII(const std::vector<unsigned char>& image_data) {
    try {
        int width, height, channels;

        // Carrega a imagem diretamente do buffer de memória que vem do JavaScript.
        unsigned char *img_buffer = stbi_load_from_memory(
            image_data.data(),
            image_data.size(),
            &width,
            &height,
            &channels,
            0 
        );

        if (img_buffer == nullptr) {
            return std::string("Erro: Formato de imagem inválido ou dados corrompidos.");
        }

        // Verificação de segurança para dimensões inválidas
        if (width <= 0 || height <= 0) {
            stbi_image_free(img_buffer);
            return std::string("Erro: Dimensões da imagem são inválidas.");
        }

        // Calcula a nova altura mantendo a proporção
        float aspect_ratio = static_cast<float>(height) / width;
        unsigned int new_height = static_cast<unsigned int>(DEFAULT_WIDTH * aspect_ratio * 0.55f);

        // Verificação de segurança para evitar divisão por zero
        if (new_height <= 0) {
            stbi_image_free(img_buffer);
            return std::string("Erro: Imagem demasiado larga para ser convertida.");
        }

        // Prepara a string de saída
        std::string ascii_art;
        ascii_art.reserve((DEFAULT_WIDTH + 1) * new_height);

        for (unsigned int y = 0; y < new_height; ++y) {
            for (unsigned int x = 0; x < DEFAULT_WIDTH; ++x) {
                // Calcula as coordenadas correspondentes na imagem original
                int original_x = static_cast<int>((static_cast<float>(x) / DEFAULT_WIDTH) * width);
                int original_y = static_cast<int>((static_cast<float>(y) / new_height) * height);

                // Calculo do índice do píxel no buffer
                int pixel_index = (original_y * width + original_x) * channels;

                // Calcula o brilho do píxel (média dos canais R, G, B)
                unsigned char r = img_buffer[pixel_index];
                unsigned char g = (channels > 1) ? img_buffer[pixel_index + 1] : r;
                unsigned char b = (channels > 2) ? img_buffer[pixel_index + 2] : r;
                int brightness = (r + g + b) / 3;

                // Mapeia o brilho para um caractere ASCII
                int ascii_index = (brightness * (ASCII_CHARS.size() - 1)) / 255;
                ascii_art += ASCII_CHARS[ascii_index];
            }
            ascii_art += '\n';
        }

        // Liberta a memória alocada pelo stb_image
        stbi_image_free(img_buffer);

        return ascii_art;

    } catch (const std::exception& e) {
        // Captura qualquer outra exceção C++ e retorna uma mensagem de erro
        return std::string("Erro C++ desconhecido: ") + e.what();
    }
}

// --- Vínculos do Emscripten (Bindings) ---
EMSCRIPTEN_BINDINGS(ascii_module) {
    register_vector<unsigned char>("VectorUChar");
    function("convertToASCII", &convertToASCII);
}
