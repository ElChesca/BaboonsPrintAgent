# Usa una imagen base de Python
FROM python:3.11-slim

# ✨ Configura el Horario de Argentina (ART)
ENV TZ=America/Argentina/Buenos_Aires
RUN apt-get update && apt-get install -y tzdata && \
    ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Establece el directorio de trabajo
WORKDIR /app

# Copia e instala dependencias
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia el código de la aplicación
COPY . .

# Expone el puerto
EXPOSE 8080

# Comando para ejecutar la app
CMD ["python", "run.py"]